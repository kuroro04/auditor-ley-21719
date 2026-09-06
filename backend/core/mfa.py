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


def verify_code(secret: str, code: str) -> bool:
    """Valida un código TOTP de 6 dígitos.

    valid_window=1 acepta también el código del período inmediatamente
    anterior y el siguiente (±30 s), para tolerar el desfase de reloj
    entre el teléfono del usuario y el servidor.
    """
    if not code:
        return False
    limpio = code.strip().replace(' ', '')
    if not (limpio.isdigit() and len(limpio) == 6):
        return False
    return pyotp.TOTP(secret).verify(limpio, valid_window=1)


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
    """Serializa a JSON los hashes bcrypt de los códigos de respaldo."""
    hashes = [
        bcrypt.hashpw(_normalizar_codigo(c).encode(), bcrypt.gensalt()).decode()
        for c in codes
    ]
    return json.dumps(hashes)


def consume_backup_code(stored_json: str | None, code: str) -> str | None:
    """Consume un código de respaldo.

    Si `code` coincide con alguno de los hashes guardados, lo elimina de la
    lista y devuelve el JSON actualizado (el código queda inutilizado). Si
    no coincide con ninguno —o no hay códigos— devuelve None.
    """
    if not stored_json or not code:
        return None
    limpio = _normalizar_codigo(code).encode()
    hashes: list[str] = json.loads(stored_json)
    for h in hashes:
        if bcrypt.checkpw(limpio, h.encode()):
            hashes.remove(h)
            return json.dumps(hashes)
    return None
