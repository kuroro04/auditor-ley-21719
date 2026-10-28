"""Bitácora de resultados de escaneo antivirus — Fase 4.

Un JSON por línea, append-only: qué se escaneó, con qué resultado y por
qué. No reemplaza una tabla de auditoría formal en la base de datos (eso
se evalúa en la Fase 6, de trazabilidad), pero deja registro sin tocar
las políticas RLS de la Fase 3.
"""
import json
import logging
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

from core.config import SCAN_LOG_PATH
from services.clamav_service import ScanResult


def log_scan_result(company_id: str, filename: str, result: ScanResult) -> None:
    SCAN_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    registro = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'company_id': company_id,
        'filename': filename,
        'status': result.status,
        'detail': result.detail,
    }
    # Bitácora del servidor: acá sí va el detalle técnico de un fallo.
    if result.detalle_interno:
        registro['detalle_interno'] = result.detalle_interno

    line = json.dumps(registro, ensure_ascii=False)
    handler = RotatingFileHandler(
        SCAN_LOG_PATH,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding='utf-8',
    )
    handler.setFormatter(logging.Formatter('%(message)s'))
    logger = logging.getLogger(f"scan_audit_log_{SCAN_LOG_PATH}")
    logger.setLevel(logging.INFO)
    logger.handlers = [handler]
    logger.propagate = False
    try:
        logger.info(line)
    finally:
        handler.close()
        logger.handlers.clear()
