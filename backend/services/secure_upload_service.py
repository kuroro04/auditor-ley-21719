"""Orquesta la carga segura — Fase 4: cuarentena -> validación -> escaneo
ClamAV. El traslado a almacenamiento definitivo lo hace quien llama.

Fail-closed: un archivo solo se acepta si ClamAV lo escaneó y lo declaró
limpio. Si la validación falla, si ClamAV detecta una amenaza, o si
ClamAV no responde, el archivo se borra de la cuarentena y se rechaza.

Un archivo aceptado queda TODAVÍA en cuarentena (outcome.quarantine_path):
el router lo mueve a STORAGE_DIR recién cuando el Document y su evento de
auditoría ya están escritos en la transacción (Fase 6). Así, si la
auditoría falla, el archivo nunca llegó a almacenamiento definitivo.
"""
import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from services.clamav_service import ESTADO_INFECTADO, ESTADO_LIMPIO, scan_with_client
from services.file_security_service import check_file_security, detected_mime, sanitize_filename
from services.quarantine_service import ensure_quarantine_dir, secure_delete, write_to_quarantine
from services.scan_audit_log import log_scan_result

# Motivo de rechazo, para la bitácora de auditoría.
MOTIVO_VALIDACION = 'validacion_tipo'    # extensión, tamaño o magic bytes / MIME inválido
MOTIVO_FIRMA = 'firma_detectada'         # ClamAV encontró una amenaza
MOTIVO_FALLO_ESCANER = 'fallo_escaner'   # ClamAV no respondió o respondió algo inesperado


@dataclass
class UploadOutcome:
    accepted: bool
    reason: str
    filename: str
    sha256: str
    size_bytes: int
    scan_status: Optional[str] = None      # None si ni siquiera se llegó a escanear
    motivo_rechazo: Optional[str] = None
    firma: Optional[str] = None
    mime_detectado: Optional[str] = None   # solo para archivos aceptados
    quarantine_path: Optional[Path] = None  # solo para archivos aceptados


def process_secure_upload(company_id: str, filename: str, content: bytes, clamav_client) -> UploadOutcome:
    ensure_quarantine_dir(company_id)
    safe_name = sanitize_filename(filename)
    sha256 = hashlib.sha256(content).hexdigest()

    # Validación en memoria (tipo, extensión, magic bytes, tamaño) antes de tocar disco
    security_result = check_file_security(safe_name, len(content), content[:8])
    if not security_result.accepted:
        return UploadOutcome(
            False, security_result.reason, safe_name, sha256, len(content),
            motivo_rechazo=MOTIVO_VALIDACION,
        )

    quarantine_path = write_to_quarantine(company_id, safe_name, content)

    scan_result = scan_with_client(clamav_client, content)
    log_scan_result(company_id, safe_name, scan_result)

    if scan_result.status != ESTADO_LIMPIO:
        secure_delete(quarantine_path)
        motivo = MOTIVO_FIRMA if scan_result.status == ESTADO_INFECTADO else MOTIVO_FALLO_ESCANER
        return UploadOutcome(
            False, scan_result.detail, safe_name, sha256, len(content),
            scan_status=scan_result.status, motivo_rechazo=motivo, firma=scan_result.signature,
        )

    return UploadOutcome(
        True, scan_result.detail, safe_name, sha256, len(content),
        scan_status=scan_result.status, mime_detectado=detected_mime(safe_name),
        quarantine_path=quarantine_path,
    )
