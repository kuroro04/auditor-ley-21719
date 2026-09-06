from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from core import config


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def create_access_token(user_id: str, company_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {'sub': user_id, 'company_id': company_id, 'role': role, 'exp': expire}
    return jwt.encode(payload, config.SECRET_KEY, algorithm=config.ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])


def create_mfa_challenge_token(user_id: str, company_id: str) -> str:
    """Token intermedio del login con MFA (Fase 5).

    NO es una sesión: lleva el claim `mfa_pending` y una expiración corta.
    Solo lo acepta /auth/login/mfa, y get_current_user lo rechaza
    explícitamente para que no pueda usarse como cookie de sesión. Incluye
    company_id (igual que el JWT de sesión ya lo expone) para poder fijar
    el contexto RLS en el segundo paso sin otra excepción a las políticas.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=config.MFA_CHALLENGE_EXPIRE_MINUTES)
    payload = {'sub': user_id, 'company_id': company_id, 'mfa_pending': True, 'exp': expire}
    return jwt.encode(payload, config.SECRET_KEY, algorithm=config.ALGORITHM)
