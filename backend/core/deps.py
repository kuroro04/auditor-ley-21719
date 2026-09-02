from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from core.config import COOKIE_NAME
from core.security import decode_access_token
from db.database import get_db
from db.tenant import set_tenant_context


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


def get_tenant_db(
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
) -> Session:
    """Como get_db, pero además fija el tenant activo para las políticas RLS.

    Los routers que atienden a un usuario ya autenticado deben depender de
    esta función (en vez de get_db a secas) para que RLS tenga el contexto
    correcto en esa transacción.
    """
    set_tenant_context(db, current.company_id)
    return db
