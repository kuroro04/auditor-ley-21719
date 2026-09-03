"""Orquesta la carga segura — Fase 4: cuarentena -> validación -> escaneo
ClamAV -> almacenamiento definitivo.

Fail-closed: un archivo solo se acepta si ClamAV lo escaneó y lo declaró
limpio. Si la validación falla, si ClamAV detecta una amenaza, o si
ClamAV no responde, el archivo se borra de la cuarentena y se rechaza.
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from services.clamav_service import ESTADO_LIMPIO, scan_with_client
from services.file_security_service import check_file_security, sanitize_filename
from services.quarantine_service import move_to_clean, secure_delete, write_to_quarantine
from services.scan_audit_log import log_scan_result


@dataclass
class UploadOutcome:
    accepted: bool
    reason: str
    filename: str
    stored_path: Optional[Path] = None


def process_secure_upload(company_id: str, filename: str, content: bytes, clamav_client) -> UploadOutcome:
    safe_name = sanitize_filename(filename)
    quarantine_path = write_to_quarantine(company_id, safe_name, content)

    security_result = check_file_security(safe_name, len(content), content[:8])
    if not security_result.accepted:
        secure_delete(quarantine_path)
        return UploadOutcome(False, security_result.reason, safe_name)

    scan_result = scan_with_client(clamav_client, content)
    log_scan_result(company_id, safe_name, scan_result)

    if scan_result.status != ESTADO_LIMPIO:
        secure_delete(quarantine_path)
        return UploadOutcome(False, scan_result.detail, safe_name)

    stored_path = move_to_clean(quarantine_path, company_id)
    return UploadOutcome(True, scan_result.detail, safe_name, stored_path)
