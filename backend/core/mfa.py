"""Utilidades de MFA (segundo factor TOTP opcional) — Fase 5.

Reúne en un solo módulo toda la criptografía del segundo factor:

- Cifrado/descifrado del secreto TOTP en reposo (Fernet). El secreto en
  claro solo existe en memoria el instante en que se genera el QR o se
  valida un código; en la base siempre está cifrado.
- Generación y validación de códigos TOTP con pyotp (RFC 6238).
- Códigos de respaldo de un solo uso, guardados hasheados.

Ninguna función registra ni devuelve el secreto en texto plano.
"""
import base64
import hashlib
import hmac
import io
import json
import secrets

import bcrypt
import pyotp
import qrcode
import qrcode.image.svg
from cryptography.fernet import Fernet, InvalidToken

from core.config import MFA_ENC_KEY

# Nombre del emisor que muestran Google Authenticator / Authy junto al código.
_ISSUER = 'DataShield'

# Alfabeto de los códigos de respaldo: mayúsculas y dígitos sin caracteres
# ambiguos (0/O, 1/I) para que sean fáciles de transcribir a mano.
_BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
_BACKUP_CODE_LEN = 10


def _fernet() -> Fernet:
    return Fernet(MFA_ENC_KEY.encode() if isinstance(MFA_ENC_KEY, str) else MFA_ENC_KEY)


def encrypt_secret(secret: str) -> str:
    """Cifra el secreto TOTP para guardarlo en la columna mfa_secret_enc."""
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(token: str) -> str:
    """Descifra el secreto TOTP guardado. Lanza si el texto cifrado es inválido."""
    return _fernet().decrypt(token.encode()).decode()


def generate_totp_secret() -> str:
    """Genera un secreto TOTP nuevo en base32 (el que se muestra en el QR)."""
    return pyotp.random_base32()


def provisioning_uri(secret: str, account_email: str) -> str:
    """URI otpauth:// que la app de autenticación codifica en el QR."""
    return pyotp.TOTP(secret).provisioning_uri(name=account_email, issuer_name=_ISSUER)


# Caché de códigos TOTP consumidos recientemente para evitar ataques de replay (90s window).
_consumed_totp_codes: dict[str, float] = {}


def is_totp_replayed(user_id: str, code: str) -> bool:
    import time
    now = time.time()
    vencidos = [k for k, exp in _consumed_totp_codes.items() if exp < now]
    for k in vencidos:
        _consumed_totp_codes.pop(k, None)
    key = f"{user_id}:{code.strip().replace(' ', '')}"
    return key in _consumed_totp_codes


def mark_totp_consumed(user_id: str, code: str) -> None:
    import time
    key = f"{user_id}:{code.strip().replace(' ', '')}"
    _consumed_totp_codes[key] = time.time() + 120.0


def verify_totp_step(secret: str, code: str, last_step: int | None = None) -> tuple[bool, int | None]:
    """Valida un código TOTP de 6 dígitos bajo RFC 6238 y previene replay multi-worker (DS-03).

    Evalúa los time-steps [0, -1, +1] respecto al tiempo actual para tolerar desfase de reloj (±30 s).
    Si se proporciona `last_step` (persistido en la base de datos para el usuario),
    cualquier time-step menor o igual a `last_step` es estrictamente rechazado (RFC 6238 Secc. 5.2).
    Devuelve (True, matched_step) si es válido, o (False, None) si no es válido o ya fue consumido.
    """
    if not code:
        return False, None
    limpio = code.strip().replace(' ', '')
    if not (limpio.isdigit() and len(limpio) == 6):
        return False, None

    totp = pyotp.TOTP(secret)
    import time
    now_ts = time.time()
    current_step = int(now_ts / totp.interval)

    # Evaluar ventana ±1: paso actual (0), paso anterior (-1), paso posterior (+1)
    for offset in (0, -1, 1):
        step = current_step + offset
        if last_step is not None and step <= last_step:
            continue
        if totp.generate_otp(step) == limpio:
            return True, step

    return False, None


def verify_code(secret: str, code: str, last_code: str | None = None, last_step: int | None = None) -> bool:
    """Valida un código TOTP de 6 dígitos.

    valid_window=1 acepta también el código del período inmediatamente
    anterior y el siguiente (±30 s), para tolerar el desfase de reloj
    entre el teléfono del usuario y el servidor.
    last_code y last_step previenen ataques de repetición.
    """
    valid, _ = verify_totp_step(secret, code, last_step=last_step)
    if not valid:
        return False
    if last_code and last_code == code.strip().replace(' ', ''):
        return False
    return True


def qr_svg_data_uri(otpauth_uri: str) -> str:
    """Devuelve el QR como imagen SVG embebida en un data URI (sin Pillow).

    El frontend lo usa directamente en <img src="...">. El secreto viaja
    dentro del dibujo del QR, nunca en claro dentro del string.
    """
    img = qrcode.make(otpauth_uri, image_factory=qrcode.image.svg.SvgImage)
    buf = io.BytesIO()
    img.save(buf)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f'data:image/svg+xml;base64,{b64}'


def generate_backup_codes(cantidad: int = 10) -> list[str]:
    """Genera códigos de respaldo de un solo uso, en claro (se muestran una vez)."""
    return [
        ''.join(secrets.choice(_BACKUP_ALPHABET) for _ in range(_BACKUP_CODE_LEN))
        for _ in range(cantidad)
    ]


def _normalizar_codigo(code: str) -> str:
    return code.strip().upper().replace('-', '').replace(' ', '')


def hash_backup_codes(codes: list[str]) -> str:
    """Serializa a JSON los hashes con salt SHA-256 de los códigos de respaldo.

    Utiliza SHA-256 con salt aleatorio de 16 bytes. Los códigos tienen ~50 bits de entropía
    aleatoria nativa, permitiendo verificación instantánea sin riesgo de DoS por CPU en bucle.
    """
    hashes = []
    for c in codes:
        salt = secrets.token_hex(16)
        limpio = _normalizar_codigo(c)
        digest = hashlib.sha256((salt + limpio).encode('utf-8')).hexdigest()
        hashes.append(f"{salt}${digest}")
    return json.dumps(hashes)


def consume_backup_code(stored_json: str | None, code: str) -> str | None:
    """Consume un código de respaldo.

    Si `code` coincide con alguno de los hashes guardados, lo elimina de la
    lista y devuelve el JSON actualizado (el código queda inutilizado). Si
    no coincide con ninguno —o no hay códigos— devuelve None.
    Soporta formato seguro SHA-256 (salt$hash) y hashes bcrypt legados ($2b$).
    """
    if not stored_json or not code:
        return None
    limpio = _normalizar_codigo(code)
    try:
        hashes: list[str] = json.loads(stored_json)
    except Exception:
        return None

    for h in hashes:
        matched = False
        if h.startswith('$2b$') or h.startswith('$2a$'):
            if bcrypt.checkpw(limpio.encode('utf-8'), h.encode('utf-8')):
                matched = True
        elif '$' in h:
            salt, digest = h.split('$', 1)
            calc = hashlib.sha256((salt + limpio).encode('utf-8')).hexdigest()
            if hmac.compare_digest(calc, digest):
                matched = True

        if matched:
            hashes.remove(h)
            return json.dumps(hashes)
    return None
