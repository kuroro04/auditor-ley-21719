"""Cliente de ClamAV (clamd) — Fase 4, carga segura.

Escanea el contenido en memoria vía el comando INSTREAM: el backend envía
los bytes directamente por el socket, sin necesidad de que el contenedor
de ClamAV vea el filesystem del backend (no hace falta compartir volúmenes).

Fail-closed: cualquier problema hablando con clamd (timeout, conexión
rechazada, respuesta rara) se devuelve como ESTADO_ERROR, nunca como
ESTADO_LIMPIO. El llamador debe tratar ESTADO_ERROR igual que un archivo
infectado: rechazarlo.
"""
import io
from dataclasses import dataclass
from typing import Optional

ESTADO_LIMPIO = 'limpio'
ESTADO_INFECTADO = 'infectado'
ESTADO_ERROR = 'error'


@dataclass
class ScanResult:
    status: str  # ESTADO_LIMPIO | ESTADO_INFECTADO | ESTADO_ERROR
    detail: str
    signature: Optional[str] = None  # nombre de la firma, solo si ESTADO_INFECTADO


def scan_with_client(client, content: bytes) -> ScanResult:
    try:
        response = client.instream(io.BytesIO(content))
    except Exception as exc:  # cualquier falla de clamd => fail-closed
        return ScanResult(ESTADO_ERROR, f'No se pudo escanear con ClamAV: {exc}')

    status, virus_name = response.get('stream', (None, None))
    if status == 'OK':
        return ScanResult(ESTADO_LIMPIO, 'Sin amenazas detectadas')
    if status == 'FOUND':
        return ScanResult(ESTADO_INFECTADO, f'Amenaza detectada: {virus_name}', virus_name)
    return ScanResult(ESTADO_ERROR, f'Respuesta inesperada de ClamAV: {response}')
