import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Nunca hardcodear el secreto real: en desarrollo cae a un valor de ejemplo,
# pero en producción SIEMPRE debe venir de backend/.env (ver .env.example).
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-change-me')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 horas

DATABASE_URL = os.getenv('DATABASE_URL', f"sqlite:///{BASE_DIR / 'backend.db'}")
FRONTEND_ORIGIN = os.getenv('FRONTEND_ORIGIN', 'http://localhost:3000')
# En producción (HTTPS) debe ser 'true' para que la cookie solo viaje por TLS.
COOKIE_SECURE = os.getenv('COOKIE_SECURE', 'false').lower() == 'true'

STORAGE_DIR = BASE_DIR / 'storage'
