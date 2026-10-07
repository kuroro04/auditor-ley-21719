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
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

ESTADO_LIMPIO = 'limpio'
ESTADO_INFECTADO = 'infectado'
ESTADO_ERROR = 'error'

# Lo que ve el cliente cuando el escaneo falla. No nombra el producto
# antivirus ni incluye el error: eso revelaría qué servicio se usa y cómo
# está desplegado (host, puerto, límites). El detalle va solo al log.
DETALLE_ESCANER_NO_DISPONIBLE = (
    'El servicio de análisis antivirus no está disponible en este momento. '
    'El archivo no fue aceptado; intente de nuevo más tarde.'
)


@dataclass
class ScanResult:
    status: str  # ESTADO_LIMPIO | ESTADO_INFECTADO | ESTADO_ERROR
    detail: str  # puede llegar al cliente HTTP: nunca con detalles internos
    signature: Optional[str] = None  # nombre de la firma, solo si ESTADO_INFECTADO
    # Solo para el log del servidor y la bitácora de escaneos; nunca se
    # devuelve en una respuesta HTTP.
    detalle_interno: Optional[str] = None


def scan_with_client(client, content: bytes) -> ScanResult:
    try:
        response = client.instream(io.BytesIO(content))
    except Exception as exc:  # cualquier falla de clamd => fail-closed
        logger.warning('No se pudo escanear con ClamAV', exc_info=True)
        return ScanResult(
            ESTADO_ERROR, DETALLE_ESCANER_NO_DISPONIBLE,
            detalle_interno=f'No se pudo escanear con ClamAV: {exc.__class__.__name__}: {exc}',
        )

    status, virus_name = response.get('stream', (None, None))
    if status == 'OK':
        return ScanResult(ESTADO_LIMPIO, 'Sin amenazas detectadas')
    if status == 'FOUND':
        return ScanResult(ESTADO_INFECTADO, f'Amenaza detectada: {virus_name}', virus_name)
    logger.warning('Respuesta inesperada de ClamAV: %r', response)
    return ScanResult(
        ESTADO_ERROR, DETALLE_ESCANER_NO_DISPONIBLE,
        detalle_interno=f'Respuesta inesperada de ClamAV: {response!r}',
    )
