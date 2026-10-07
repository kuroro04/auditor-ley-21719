import json

import services.scan_audit_log as sal
from services.clamav_service import ESTADO_ERROR, ESTADO_LIMPIO, ScanResult
from services.scan_audit_log import log_scan_result


def test_log_scan_result_escribe_una_linea_json(tmp_path, monkeypatch):
    ruta_log = tmp_path / 'document_scans.log'
    monkeypatch.setattr(sal, 'SCAN_LOG_PATH', ruta_log)

    log_scan_result('empresa-1', 'doc.pdf', ScanResult(ESTADO_LIMPIO, 'Sin amenazas detectadas'))

    lineas = ruta_log.read_text(encoding='utf-8').strip().splitlines()
    assert len(lineas) == 1
    registro = json.loads(lineas[0])
    assert registro['company_id'] == 'empresa-1'
    assert registro['filename'] == 'doc.pdf'
    assert registro['status'] == ESTADO_LIMPIO
    assert 'timestamp' in registro


def test_log_scan_result_guarda_el_detalle_interno_de_un_fallo(tmp_path, monkeypatch):
    # El detalle técnico que no se expone por HTTP sí debe quedar en la
    # bitácora del servidor, para poder diagnosticar el fallo.
    ruta_log = tmp_path / 'document_scans.log'
    monkeypatch.setattr(sal, 'SCAN_LOG_PATH', ruta_log)

    log_scan_result('empresa-1', 'doc.pdf', ScanResult(
        ESTADO_ERROR, 'genérico', detalle_interno='ConnectionError: Error connecting to clamd:3310',
    ))

    registro = json.loads(ruta_log.read_text(encoding='utf-8').strip())
    assert registro['detail'] == 'genérico'
    assert registro['detalle_interno'] == 'ConnectionError: Error connecting to clamd:3310'


def test_log_scan_result_es_append_only(tmp_path, monkeypatch):
    ruta_log = tmp_path / 'document_scans.log'
    monkeypatch.setattr(sal, 'SCAN_LOG_PATH', ruta_log)

    log_scan_result('empresa-1', 'doc1.pdf', ScanResult(ESTADO_LIMPIO, 'ok'))
    log_scan_result('empresa-1', 'doc2.pdf', ScanResult(ESTADO_LIMPIO, 'ok'))

    lineas = ruta_log.read_text(encoding='utf-8').strip().splitlines()
    assert len(lineas) == 2
