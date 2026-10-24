from dataclasses import dataclass
from typing import Optional

import clamd
import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from core.config import CLAMAV_HOST, CLAMAV_PORT, CLAMAV_TIMEOUT_SECONDS, COOKIE_NAME, TRUST_PROXY
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

    Solo lee X-Forwarded-For cuando TRUST_PROXY=true en el entorno, lo que
    garantiza que hay un proxy de confianza delante que sobrescribe ese header
    antes de reenviar la request. Sin esa garantía cualquier cliente podría
    falsificar su IP en la bitácora de auditoría.
    En desarrollo local y cuando la app queda expuesta directamente a internet
    se usa request.client.host (la IP TCP real de quien se conecta).
    """
    if TRUST_PROXY:
        forwarded = request.headers.get('x-forwarded-for')
        if forwarded:
            # Leer el último valor: Nginx (con X-Forwarded-For $remote_addr) escribe
            # solo su IP real aquí. En una cadena de proxies, el último valor es el
            # añadido por el proxy más cercano a nosotros (el de confianza), mientras
            # que los valores anteriores pueden haber sido fabricados por el cliente.
            return forwarded.split(',')[-1].strip()
    return request.client.host if request.client else None


def get_clamav_client() -> clamd.ClamdNetworkSocket:
    """Cliente real de ClamAV (clamd), construido desde CLAMAV_HOST/PORT.

    En los tests se sobreescribe (app.dependency_overrides) con un cliente
    falso, para no depender de un contenedor de ClamAV corriendo.
    """
    return clamd.ClamdNetworkSocket(host=CLAMAV_HOST, port=CLAMAV_PORT, timeout=CLAMAV_TIMEOUT_SECONDS)
