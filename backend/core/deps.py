from dataclasses import dataclass
from datetime import timezone
from typing import Optional

import clamd
import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from core.config import CLAMAV_HOST, CLAMAV_PORT, CLAMAV_TIMEOUT_SECONDS, COOKIE_NAME, TRUST_PROXY, is_trusted_proxy
from core.security import decode_access_token
from db.database import get_db
from db.models import User
from db.tenant import set_tenant_context


@dataclass
class CurrentUser:
    user_id: str
    company_id: str
    role: str


def get_current_user(request: Request, db: Session = Depends(get_db)) -> CurrentUser:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='No autenticado')
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Sesión inválida o expirada')
    # Un token intermedio de MFA (mfa_pending) nunca es una sesión válida:
    # solo /auth/login/mfa lo acepta, para canjearlo por la cookie real.
    if payload.get('mfa_pending'):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Sesión inválida o expirada')

    user_id = payload.get('sub')
    company_id = payload.get('company_id')
    if not user_id or not company_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token con estructura inválida')

    # Fijar contexto RLS para permitir consulta a users en PostgreSQL
    set_tenant_context(db, company_id)

    user = db.query(User).filter(User.id == user_id).first()
    if user is not None:
        # Hallazgo DS-02: Verificación de revocación de token (cierre de sesión en servidor)
        token_ver = payload.get('ver')
        user_ver = getattr(user, 'token_version', 1) or 1
        if token_ver is not None and token_ver != user_ver:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Sesión invalidada tras cierre de sesión')

    return CurrentUser(user_id=user_id, company_id=company_id, role=payload.get('role', ''))


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


def client_ip(request: Request) -> Optional[str]:
    """IP de origen del cliente, para la bitácora de auditoría (Fase 6).

    Solo lee X-Forwarded-For cuando TRUST_PROXY=true y la conexión TCP proviene
    de un proxy de confianza (is_trusted_proxy).
    """
    client_host = request.client.host if request.client else None
    if TRUST_PROXY and is_trusted_proxy(client_host, trust_proxy_enabled=TRUST_PROXY):
        forwarded = request.headers.get('x-forwarded-for')
        if forwarded:
            return forwarded.split(',')[-1].strip()
    return client_host


def get_clamav_client() -> clamd.ClamdNetworkSocket:
    """Cliente real de ClamAV (clamd), construido desde CLAMAV_HOST/PORT.

    En los tests se sobreescribe (app.dependency_overrides) con un cliente
    falso, para no depender de un contenedor de ClamAV corriendo.
    """
    return clamd.ClamdNetworkSocket(host=CLAMAV_HOST, port=CLAMAV_PORT, timeout=CLAMAV_TIMEOUT_SECONDS)
