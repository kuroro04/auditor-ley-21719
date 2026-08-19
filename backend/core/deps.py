from dataclasses import dataclass

import jwt
from fastapi import HTTPException, Request, status

from core.config import COOKIE_NAME
from core.security import decode_access_token


@dataclass
class CurrentUser:
    user_id: str
    company_id: str
    role: str


def get_current_user(request: Request) -> CurrentUser:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='No autenticado')
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Sesión inválida o expirada')
    return CurrentUser(user_id=payload['sub'], company_id=payload['company_id'], role=payload['role'])
