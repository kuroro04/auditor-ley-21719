from fastapi import Request
from slowapi import Limiter

from core.config import TESTING, TRUST_PROXY


def _rate_limit_key(request: Request) -> str:
    """Clave de rate-limit por IP de cliente.

    Usa la misma lógica que client_ip() de core/deps para respetar TRUST_PROXY:
    con un proxy de confianza delante (Nginx), lee el último valor de
    X-Forwarded-For —que el proxy escribe con $remote_addr— en lugar de
    request.client.host, que siempre sería la IP del proxy (lo que haría el
    límite global para toda la app en vez de por cliente).
    """
    if TRUST_PROXY:
        forwarded = request.headers.get('x-forwarded-for')
        if forwarded:
            return forwarded.split(',')[-1].strip()
    return (request.client.host if request.client else None) or '0.0.0.0'


# Instancia compartida por todos los routers.
# En modo test (TESTING=1) el limitador queda deshabilitado: los tests pueden
# llamar a los endpoints tantas veces como necesiten sin ser bloqueados.
limiter = Limiter(key_func=_rate_limit_key, enabled=not TESTING)
