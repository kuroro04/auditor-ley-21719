from dataclasses import dataclass
from typing import Optional

import clamd
import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from core.config import CLAMAV_HOST, CLAMAV_PORT, CLAMAV_TIMEOUT_SECONDS, COOKIE_NAME
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
    # Un token intermedio de MFA (mfa_pending) nunca es una sesión válida:
    # solo /auth/login/mfa lo acepta, para canjearlo por la cookie real.
    if payload.get('mfa_pending'):
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


def client_ip(request: Request) -> Optional[str]:
    """IP de origen del cliente, para la bitácora de auditoría (Fase 6).

    Si hay un proxy inverso delante (Nginx, balanceador del proveedor, etc.),
    la IP real del cliente viaja en X-Forwarded-For y request.client.host es
    la del proxy, no la del usuario. Se usa la primera IP de la lista (el
    cliente original; las siguientes, si hay más de un proxy encadenado, son
    saltos intermedios).
    Confiar en este header SOLO es seguro si hay un proxy de confianza que lo
    sobrescribe antes de reenviar la request: cualquier cliente puede mandar
    su propio X-Forwarded-For, así que si la app llegara a quedar expuesta
    directamente a internet sin ese proxy delante, el header sería
    falsificable y habría que usar solo request.client.host.
    Si el header no viene (no hay proxy delante, o es una conexión directa
    como en los tests), se cae a request.client.host; si tampoco hay
    conexión TCP asociada (posible en algunos entornos de test), devuelve
    None — nunca lanza una excepción por esto.
    """
    forwarded = request.headers.get('x-forwarded-for')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.client.host if request.client else None


def get_clamav_client() -> clamd.ClamdNetworkSocket:
    """Cliente real de ClamAV (clamd), construido desde CLAMAV_HOST/PORT.

    En los tests se sobreescribe (app.dependency_overrides) con un cliente
    falso, para no depender de un contenedor de ClamAV corriendo.
    """
    return clamd.ClamdNetworkSocket(host=CLAMAV_HOST, port=CLAMAV_PORT, timeout=CLAMAV_TIMEOUT_SECONDS)
