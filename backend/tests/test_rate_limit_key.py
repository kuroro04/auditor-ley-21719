"""
Tests para la función _rate_limit_key de core/limiter.py.

Verifican que el rate limiting se hace por IP de cliente real, no por IP del
proxy, cuando la app está detrás de Nginx (TRUST_PROXY=true).
"""
import pytest
from unittest.mock import MagicMock

from core.limiter import _rate_limit_key


def _make_request(client_host: str, xff: str | None = None) -> MagicMock:
    """Crea un Request falso con client.host y el header X-Forwarded-For."""
    req = MagicMock()
    req.client.host = client_host
    req.headers.get = lambda key, default=None: (
        xff if key == 'x-forwarded-for' and xff is not None else default
    )
    return req


def test_sin_trust_proxy_usa_client_host(monkeypatch):
    monkeypatch.setattr('core.limiter.TRUST_PROXY', False)
    req = _make_request('203.0.113.5', xff='10.0.0.1')
    assert _rate_limit_key(req) == '203.0.113.5'


def test_con_trust_proxy_usa_ultimo_xff(monkeypatch):
    # Con Nginx usando X-Forwarded-For $remote_addr, el último valor es la
    # IP real del cliente (o la del proxy más cercano de confianza). Sin este
    # comportamiento, todos los clientes compartirían la IP del proxy y el
    # límite sería global.
    monkeypatch.setattr('core.limiter.TRUST_PROXY', True)
    # Nginx escribe $remote_addr en XFF: un solo valor = la IP real
    req = _make_request('10.0.0.1', xff='203.0.113.5')
    assert _rate_limit_key(req) == '203.0.113.5'


def test_con_trust_proxy_cadena_xff_lee_el_ultimo(monkeypatch):
    # Si hubiera varios proxies en cadena, el último valor (más cercano) es
    # el de confianza; los anteriores pueden haber sido fabricados por el cliente.
    monkeypatch.setattr('core.limiter.TRUST_PROXY', True)
    req = _make_request('10.0.0.1', xff='1.2.3.4, 5.6.7.8, 10.0.0.1')
    assert _rate_limit_key(req) == '10.0.0.1'


def test_con_trust_proxy_sin_xff_cae_a_client_host(monkeypatch):
    monkeypatch.setattr('core.limiter.TRUST_PROXY', True)
    req = _make_request('203.0.113.5', xff=None)
    assert _rate_limit_key(req) == '203.0.113.5'


def test_sin_client_host_devuelve_fallback(monkeypatch):
    monkeypatch.setattr('core.limiter.TRUST_PROXY', False)
    req = MagicMock()
    req.client = None
    req.headers.get = lambda key, default=None: default
    assert _rate_limit_key(req) == '0.0.0.0'
