import clamd as clamd_lib

from services.clamav_service import ESTADO_ERROR, ESTADO_INFECTADO, ESTADO_LIMPIO, scan_with_client


class _ClienteFalsoLimpio:
    def instream(self, buffer):
        return {'stream': ('OK', None)}


class _ClienteFalsoInfectado:
    def instream(self, buffer):
        return {'stream': ('FOUND', 'Eicar-Test-Signature')}


class _ClienteFalsoCaido:
    def instream(self, buffer):
        raise clamd_lib.ConnectionError('ClamAV no responde (prueba)')


def test_scan_con_clamav_limpio_devuelve_estado_limpio():
    resultado = scan_with_client(_ClienteFalsoLimpio(), b'contenido inofensivo')
    assert resultado.status == ESTADO_LIMPIO


def test_scan_con_clamav_detecta_virus_devuelve_estado_infectado():
    resultado = scan_with_client(_ClienteFalsoInfectado(), clamd_lib.EICAR)
    assert resultado.status == ESTADO_INFECTADO
    assert 'Eicar-Test-Signature' in resultado.detail


def test_scan_con_clamav_caido_devuelve_estado_error_fail_closed():
    resultado = scan_with_client(_ClienteFalsoCaido(), b'cualquier contenido')
    assert resultado.status == ESTADO_ERROR
