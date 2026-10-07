import logging

import clamd as clamd_lib

from services.clamav_service import (
    DETALLE_ESCANER_NO_DISPONIBLE, ESTADO_ERROR, ESTADO_INFECTADO, ESTADO_LIMPIO, scan_with_client,
)


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


class _ClienteFalsoRespuestaRara:
    def instream(self, buffer):
        return {'stream': ('ERROR', 'INSTREAM size limit exceeded')}


def test_scan_con_clamav_caido_devuelve_estado_error_fail_closed():
    resultado = scan_with_client(_ClienteFalsoCaido(), b'cualquier contenido')
    assert resultado.status == ESTADO_ERROR


def _assert_detalle_publico_generico(resultado, texto_interno):
    # `detail` puede llegar al cliente HTTP: no debe revelar el producto
    # antivirus ni el error interno. Eso queda solo en detalle_interno.
    assert resultado.detail == DETALLE_ESCANER_NO_DISPONIBLE
    assert 'clamav' not in resultado.detail.lower()
    assert texto_interno not in resultado.detail
    assert texto_interno in resultado.detalle_interno


def test_clamav_caido_no_expone_la_excepcion_en_el_detalle_publico(caplog):
    with caplog.at_level(logging.WARNING, logger='services.clamav_service'):
        resultado = scan_with_client(_ClienteFalsoCaido(), b'cualquier contenido')
    _assert_detalle_publico_generico(resultado, 'ClamAV no responde (prueba)')
    # El detalle técnico sí queda en el log del servidor.
    assert 'ClamAV no responde (prueba)' in caplog.text


def test_respuesta_inesperada_de_clamav_no_se_expone_en_el_detalle_publico(caplog):
    with caplog.at_level(logging.WARNING, logger='services.clamav_service'):
        resultado = scan_with_client(_ClienteFalsoRespuestaRara(), b'cualquier contenido')
    assert resultado.status == ESTADO_ERROR
    _assert_detalle_publico_generico(resultado, 'INSTREAM size limit exceeded')
    assert 'INSTREAM size limit exceeded' in caplog.text
