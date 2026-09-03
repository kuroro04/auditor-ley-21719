"""Bitácora de resultados de escaneo antivirus — Fase 4.

Un JSON por línea, append-only: qué se escaneó, con qué resultado y por
qué. No reemplaza una tabla de auditoría formal en la base de datos (eso
se evalúa en la Fase 6, de trazabilidad), pero deja registro sin tocar
las políticas RLS de la Fase 3.
"""
import json
from datetime import datetime, timezone

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
    with open(SCAN_LOG_PATH, 'a', encoding='utf-8') as f:
        f.write(json.dumps(registro, ensure_ascii=False) + '\n')
