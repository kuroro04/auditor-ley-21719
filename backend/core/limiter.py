from fastapi import Request
from slowapi import Limiter

from core.config import TESTING, TRUST_PROXY, is_trusted_proxy


def _rate_limit_key(request: Request) -> str:
    """Clave de rate-limit por IP de cliente.

    Usa la misma lógica que client_ip() de core/deps para respetar TRUST_PROXY y KNOWN_PROXIES.
    """
    client_host = request.client.host if request.client else None
    if TRUST_PROXY and is_trusted_proxy(client_host, trust_proxy_enabled=TRUST_PROXY):
        forwarded = request.headers.get('x-forwarded-for')
        if forwarded:
            return forwarded.split(',')[-1].strip()
    return client_host or '0.0.0.0'


# Instancia compartida por todos los routers.
# En modo test (TESTING=1) el limitador queda deshabilitado: los tests pueden
# llamar a los endpoints tantas veces como necesiten sin ser bloqueados.
limiter = Limiter(key_func=_rate_limit_key, enabled=not TESTING)
