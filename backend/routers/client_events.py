"""Eventos de auditoría REPORTADOS POR EL CLIENTE (Fase 6).

LIMITACIÓN — leer antes de usar estos registros como evidencia:

El diagnóstico y la exportación del informe PDF corren completos en el
navegador (lib/analyzer.ts, lib/pdfExport.ts); el servidor nunca ve esas
operaciones. Este endpoint solo recibe un aviso del frontend diciendo que
ocurrieron. Por lo tanto:

- Un cliente modificado (o una llamada directa a la lógica de la página)
  puede ejecutar el diagnóstico o generar el PDF SIN enviar el aviso, y
  no quedará ningún registro.
- También puede enviar el aviso sin haber hecho nada.

Estos eventos NO constituyen trazabilidad verificable: son una declaración
del cliente, no una observación del servidor. Por eso cada uno se guarda
con `detalle.origen = 'reportado_por_cliente'`, para que nadie que lea la
bitácora los confunda con los eventos que sí observa el servidor (subida,
descarga, eliminación). La garantía real exigiría mover el diagnóstico y la
exportación al backend.

El fail-closed de exportacion_resultados (EVENTOS_CRITICOS) se mantiene en
el sentido limitado que permite este diseño: si el registro falla se
responde 503 y el frontend legítimo no genera el PDF. No protege frente a
un cliente que se salte el aviso.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from core.deps import CurrentUser, client_ip, get_current_user, get_tenant_db
from core.limiter import limiter
from models.schemas import ClientEventRequest
from services import audit

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/audit', tags=['audit'])

ORIGEN_CLIENTE = 'reportado_por_cliente'


@router.post('/client-events', status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit('20/minute')
def report_client_event(
    payload: ClientEventRequest,
    request: Request,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_tenant_db),
):
    try:
        # registrar_evento solo relanza para EVENTOS_CRITICOS (exportación);
        # para diagnostico_ejecutado un fallo se loguea y se responde 204.
        audit.registrar_evento(
            db, payload.evento, 'exito',
            user_id=current.user_id, company_id=current.company_id, ip_origen=client_ip(request),
            detalle={'origen': ORIGEN_CLIENTE, 'verificable_por_servidor': False},
        )
        db.commit()
    except Exception:
        logger.exception('No se pudo registrar el evento reportado por el cliente "%s"', payload.evento)
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail='No se pudo registrar la operación en la bitácora de auditoría.',
        )
