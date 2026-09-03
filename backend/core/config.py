import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Modo de excepción explícito para pytest: conftest.py lo activa antes de
# importar la app, para que los tests nunca dependan de un backend/.env real.
TESTING = os.getenv('TESTING') == '1'

_DEFAULT_SECRET_KEY = 'dev-secret-change-me'
_secret_key = os.getenv('SECRET_KEY')
if not TESTING and (not _secret_key or _secret_key == _DEFAULT_SECRET_KEY):
    raise RuntimeError(
        "SECRET_KEY no está definida (o quedó en el valor de ejemplo del código). "
        "Define una clave real y secreta en backend/.env antes de arrancar el backend."
    )
SECRET_KEY = _secret_key or _DEFAULT_SECRET_KEY
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 horas

DATABASE_URL = os.getenv('DATABASE_URL', f"sqlite:///{BASE_DIR / 'backend.db'}")
FRONTEND_ORIGIN = os.getenv('FRONTEND_ORIGIN', 'http://localhost:3000')

_cookie_secure = os.getenv('COOKIE_SECURE')
if not TESTING and _cookie_secure is None:
    raise RuntimeError(
        "COOKIE_SECURE no está definida. Fíjala explícitamente en backend/.env "
        "('true' en producción con HTTPS, 'false' solo en desarrollo local por HTTP)."
    )
# En producción (HTTPS) debe ser 'true' para que la cookie solo viaje por TLS.
COOKIE_SECURE = (_cookie_secure or 'false').lower() == 'true'
COOKIE_NAME = 'access_token'
COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8  # 8 horas, igual que ACCESS_TOKEN_EXPIRE_MINUTES

STORAGE_DIR = BASE_DIR / 'storage'

# Fase 4 — carga segura con cuarentena + ClamAV.
# La cuarentena vive separada de STORAGE_DIR: un archivo solo llega a
# STORAGE_DIR si ClamAV lo declaró limpio.
QUARANTINE_DIR = BASE_DIR / 'quarantine'
SCAN_LOG_PATH = BASE_DIR / 'logs' / 'document_scans.log'

CLAMAV_HOST = os.getenv('CLAMAV_HOST', 'localhost')
CLAMAV_PORT = int(os.getenv('CLAMAV_PORT', '3310'))
CLAMAV_TIMEOUT_SECONDS = float(os.getenv('CLAMAV_TIMEOUT_SECONDS', '15'))
