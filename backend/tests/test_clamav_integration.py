"""Test de integración real contra ClamAV — Fase 4.

A diferencia del resto de la suite (que usa un cliente ClamAV falso para
no depender de Docker), este test habla con un `clamd` de verdad. Se
salta automáticamente si no hay ClamAV escuchando en CLAMAV_HOST/PORT,
así no rompe `pytest` en máquinas sin Docker levantado.

Para correrlo de verdad:
    docker compose up -d clamav
    # esperar a que "docker compose ps" diga "healthy"
    cd backend && python -m pytest tests/test_clamav_integration.py -v
"""
import clamd
import pytest

from core.config import CLAMAV_HOST, CLAMAV_PORT, CLAMAV_TIMEOUT_SECONDS
from services.clamav_service import ESTADO_INFECTADO, ESTADO_LIMPIO, scan_with_client

PDF_LIMPIO = b'%PDF-1.4\n%contenido inofensivo de prueba\n'


def _clamav_disponible() -> bool:
    try:
        cliente = clamd.ClamdNetworkSocket(host=CLAMAV_HOST, port=CLAMAV_PORT, timeout=3)
        return cliente.ping() == 'PONG'
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _clamav_disponible(),
    reason='ClamAV no está corriendo (docker compose up -d clamav) — se salta el test de integración real',
)


def test_clamav_real_declara_limpio_un_archivo_inofensivo():
    cliente = clamd.ClamdNetworkSocket(host=CLAMAV_HOST, port=CLAMAV_PORT, timeout=CLAMAV_TIMEOUT_SECONDS)
    resultado = scan_with_client(cliente, PDF_LIMPIO)
    assert resultado.status == ESTADO_LIMPIO


def test_clamav_real_detecta_el_string_eicar_estandar():
    cliente = clamd.ClamdNetworkSocket(host=CLAMAV_HOST, port=CLAMAV_PORT, timeout=CLAMAV_TIMEOUT_SECONDS)
    resultado = scan_with_client(cliente, clamd.EICAR)
    assert resultado.status == ESTADO_INFECTADO
    assert 'eicar' in resultado.detail.lower()
