import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Cargar backend/.env explícitamente desde BASE_DIR y luego del entorno de trabajo
load_dotenv(BASE_DIR / '.env')
load_dotenv()

# Modo de excepción explícito para pytest: conftest.py lo activa antes de
# importar la app, para que los tests nunca dependan de un backend/.env real.
TESTING = os.getenv('TESTING') == '1'

_DEFAULT_SECRET_KEYS = {
    'dev-secret-change-me',
    'change-me-in-production-use-a-long-random-string',
}
_secret_key = os.getenv('SECRET_KEY')
if not TESTING and (not _secret_key or _secret_key in _DEFAULT_SECRET_KEYS or len(_secret_key) < 32):
    raise RuntimeError(
        "SECRET_KEY no está definida, es demasiado corta (< 32 caracteres) "
        "o quedó en un valor de ejemplo. Define una clave real y segura en backend/.env."
    )
SECRET_KEY = _secret_key or 'dev-secret-change-me'
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 horas
# Fase 5 — vida del token intermedio del login con MFA: solo sirve para
# canjear el código TOTP por la sesión real, así que dura poco.
MFA_CHALLENGE_EXPIRE_MINUTES = 5

# Fase 5 — MFA (segundo factor TOTP opcional).
# Clave Fernet con la que se cifra en reposo el secreto TOTP de cada usuario
# (nunca se guarda en texto plano). Fail-closed igual que SECRET_KEY: sin ella
# el backend no arranca en producción. En los tests se genera una efímera:
# los secretos MFA de prueba viven solo en la base en memoria de cada test.
_REJECTED_MFA_KEYS = {'change-me-generate-a-fernet-key'}
_mfa_enc_key = os.getenv('MFA_ENC_KEY')
if not TESTING and (not _mfa_enc_key or _mfa_enc_key in _REJECTED_MFA_KEYS):
    raise RuntimeError(
        "MFA_ENC_KEY no está definida o quedó en el valor de ejemplo. Genera una con:\n"
        "  python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"\n"
        "y ponla en backend/.env antes de arrancar el backend."
    )
if _mfa_enc_key:
    MFA_ENC_KEY = _mfa_enc_key
else:
    from cryptography.fernet import Fernet
    MFA_ENC_KEY = Fernet.generate_key().decode()

DATABASE_URL = os.getenv('DATABASE_URL', f"sqlite:///{BASE_DIR / 'backend.db'}")

# Entorno de ejecución. Defecto: 'production' (fail-closed): si alguien despliega
# sin fijar esta variable, SQLite queda bloqueado y la app no arranca, lo que es
# el comportamiento correcto. Para desarrollo local sin Supabase hay que fijar
# explícitamente ENVIRONMENT=development en backend/.env.
APP_ENV = os.getenv('ENVIRONMENT', 'production')

if not TESTING and APP_ENV != 'development' and DATABASE_URL.startswith('sqlite'):
    raise RuntimeError(
        "DATABASE_URL apunta a SQLite, que no soporta Row-Level Security. "
        "Sin RLS no hay aislamiento entre empresas (multi-tenant). "
        "Opciones: (1) define una URL de PostgreSQL en backend/.env, "
        "o (2) pon ENVIRONMENT=development para desarrollo local sin Supabase."
    )
FRONTEND_ORIGIN = os.getenv('FRONTEND_ORIGIN', 'http://localhost:3000')

_cookie_secure = os.getenv('COOKIE_SECURE')
if not TESTING and _cookie_secure is None:
    raise RuntimeError(
        "COOKIE_SECURE no está definida. Fíjala explícitamente en backend/.env "
        "('true' en producción con HTTPS, 'false' solo en desarrollo local por HTTP)."
    )
# En producción (HTTPS) debe ser 'true' para que la cookie solo viaje por TLS.
COOKIE_SECURE = (_cookie_secure or 'false').lower() == 'true'
if not TESTING and APP_ENV == 'production' and not COOKIE_SECURE:
    raise RuntimeError(
        "COOKIE_SECURE debe ser 'true' cuando ENVIRONMENT=production para garantizar que la cookie solo viaje por TLS/HTTPS."
    )
COOKIE_NAME = 'access_token'
COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8  # 8 horas, igual que ACCESS_TOKEN_EXPIRE_MINUTES

STORAGE_DIR = BASE_DIR / 'storage'

# Fase 4 — carga segura con cuarentena + ClamAV.
# La cuarentena vive separada de STORAGE_DIR: un archivo solo llega a
# STORAGE_DIR si ClamAV lo declaró limpio.
QUARANTINE_DIR = BASE_DIR / 'quarantine'
SCAN_LOG_PATH = BASE_DIR / 'logs' / 'document_scans.log'

MAX_UPLOAD_BYTES = int(os.getenv('MAX_UPLOAD_BYTES', str(20 * 1024 * 1024)))  # 20 MB por defecto

CLAMAV_HOST = os.getenv('CLAMAV_HOST', 'localhost')
CLAMAV_PORT = int(os.getenv('CLAMAV_PORT', '3310'))
CLAMAV_TIMEOUT_SECONDS = float(os.getenv('CLAMAV_TIMEOUT_SECONDS', '15'))

# Fase 6 — copia externa de la bitácora de auditoría en Better Stack.
# Opcional: sin token o sin host, el envío queda desactivado y la aplicación
# funciona igual (la bitácora local en audit_log sigue siendo la fuente de
# verdad). En tests siempre desactivado, aunque backend/.env lo tenga: los
# tests que lo necesitan inyectan un enviador con transporte HTTP simulado.
BETTERSTACK_SOURCE_TOKEN = None if TESTING else (os.getenv('BETTERSTACK_SOURCE_TOKEN') or None)
BETTERSTACK_INGEST_HOST = None if TESTING else (os.getenv('BETTERSTACK_INGEST_HOST') or None)

# Si hay un proxy inverso de confianza delante (Nginx, balanceador, etc.),
# poner 'true' para que client_ip() lea X-Forwarded-For solo si proviene de KNOWN_PROXIES.
# En desarrollo local o si la app queda expuesta directo a internet: 'false'.
TRUST_PROXY = os.getenv('TRUST_PROXY', 'false').lower() == 'true'

_known_proxies_raw = os.getenv('KNOWN_PROXIES', '127.0.0.1,::1,localhost,testclient,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16')
KNOWN_PROXIES = [p.strip() for p in _known_proxies_raw.split(',') if p.strip()]


def is_trusted_proxy(ip: str | None, trust_proxy_enabled: bool | None = None) -> bool:
    enabled = TRUST_PROXY if trust_proxy_enabled is None else trust_proxy_enabled
    if not ip or not enabled:
        return False
    ip = ip.strip()
    if ip in ('localhost', '127.0.0.1', '::1') and ('localhost' in KNOWN_PROXIES or '127.0.0.1' in KNOWN_PROXIES or '::1' in KNOWN_PROXIES):
        return True
    import ipaddress
    try:
        ip_obj = ipaddress.ip_address(ip)
    except ValueError:
        return ip in KNOWN_PROXIES

    for proxy in KNOWN_PROXIES:
        if proxy == ip:
            return True
        try:
            if '/' in proxy and ip_obj in ipaddress.ip_network(proxy, strict=False):
                return True
        except ValueError:
            continue
    return False
