import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from core.config import MAX_UPLOAD_BYTES
from core.deps import CurrentUser, client_ip, get_clamav_client, get_current_user, get_tenant_db
from core.limiter import limiter
from db.models import Document
from models.schemas import DocumentOut
from services import audit
from services.file_security_service import sanitize_filename
from services import quarantine_service as qs
from services.quarantine_service import clean_destination, move_to_clean, secure_delete
from services.secure_upload_service import process_secure_upload


async def _read_limited(file: UploadFile, limit: int) -> bytes:
    """Lee el archivo cargado en bloques de 64 KB y aborta si supera `limit` bytes.

    Impide que un archivo enorme se cargue completo en memoria antes de ser
    validado, evitando el agotamiento de RAM con cargas simultáneas o maliciosas.
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(65536)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise HTTPException(
                status_code=413,
                detail=f'El archivo supera el límite de {limit // (1024 * 1024)} MB permitido.',
            )
        chunks.append(chunk)
    return b''.join(chunks)

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/documents', tags=['documents'])


def _to_document_out(doc: Document) -> DocumentOut:
    return DocumentOut(
        id=doc.id, req_id=doc.req_id, filename=doc.filename,
        content_type=doc.content_type, size_bytes=doc.size_bytes,
        uploaded_at=doc.uploaded_at.isoformat(),
    )


@router.post('/upload', response_model=DocumentOut, status_code=201)
@limiter.limit('20/hour')
async def upload_document(
    request: Request,
    req_id: str = Form(...),
    file: UploadFile = File(...),
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_tenant_db),
    clamav_client=Depends(get_clamav_client),
):
    content = await _read_limited(file, MAX_UPLOAD_BYTES)
    ip = client_ip(request)
    # Carga segura (Fase 4): cuarentena -> validación MIME/magic bytes ->
    # escaneo ClamAV. Fail-closed: si ClamAV no responde, outcome.accepted
    # queda en False igual que si estuviera infectado. Un archivo aceptado
    # sigue en cuarentena hasta más abajo.
    outcome = process_secure_upload(current.company_id, file.filename or 'archivo', content, clamav_client)

    # En `detalle` solo metadatos del archivo, nunca su contenido.
    metadatos = {
        'nombre_archivo': outcome.filename,
        'sha256': outcome.sha256,
        'tamano_bytes': outcome.size_bytes,
    }

    if not outcome.accepted:
        # El archivo ya se borró de la cuarentena: acá no hay operación que
        # deshacer, solo dejar constancia del rechazo y su motivo.
        audit.registrar_evento(
            db, audit.EVENTO_DOCUMENTO_RECHAZADO_ANTIVIRUS, 'rechazado',
            user_id=current.user_id, company_id=current.company_id, ip_origen=ip,
            detalle={
                **metadatos,
                'motivo': outcome.motivo_rechazo,
                'veredicto_escaneo': outcome.scan_status,
                'firma': outcome.firma,
                'mime_declarado': file.content_type,
            },
        )
        db.commit()
        # `codigo` (validacion_tipo / firma_detectada / fallo_escaner) le
        # permite al frontend explicar el rechazo sin depender del texto de
        # `detail`, que sigue siendo un string por compatibilidad.
        return JSONResponse(status_code=400, content={'detail': outcome.reason, 'codigo': outcome.motivo_rechazo})

    # Fase 6 — orden de la subida, para que la auditoría fail-closed y el
    # archivo en disco vivan o mueran juntos:
    #   1. Document + evento de auditoría en la transacción (flush, sin
    #      commit). Si la auditoría falla, el archivo sigue en cuarentena.
    #   2. Recién entonces se mueve el archivo a almacenamiento definitivo
    #      (un rename dentro del mismo filesystem).
    #   3. Commit.
    # Si cualquiera de los tres pasos falla, rollback de la base y borrado
    # seguro del archivo, esté donde esté (cuarentena o definitivo): el
    # rollback de base no deshace un movimiento en disco, así que esa
    # compensación se hace a mano. secure_delete no falla si la ruta no
    # existe, por eso se puede llamar sobre ambas sin saber en qué paso se
    # cortó.
    destino = clean_destination(outcome.quarantine_path, current.company_id)
    try:
        doc = Document(
            id=str(uuid.uuid4()),
            company_id=current.company_id,
            req_id=req_id,
            filename=outcome.filename,
            stored_path=str(destino),
            content_type=file.content_type or 'application/octet-stream',
            size_bytes=outcome.size_bytes,
            uploaded_by=current.user_id,
        )
        db.add(doc)
        audit.registrar_evento(
            db, audit.EVENTO_DOCUMENTO_SUBIDO, 'exito',
            user_id=current.user_id, company_id=current.company_id, ip_origen=ip,
            detalle={
                **metadatos,
                'document_id': doc.id,
                'req_id': req_id,
                'mime_detectado': outcome.mime_detectado,
                'veredicto_escaneo': outcome.scan_status,
            },
        )
        move_to_clean(outcome.quarantine_path, current.company_id)
        db.commit()
    except Exception:
        logger.exception('Carga de documento revertida (company_id=%s)', current.company_id)
        db.rollback()
        secure_delete(outcome.quarantine_path)
        secure_delete(destino)
        raise HTTPException(
            status_code=503,
            detail='No se pudo registrar la carga en la bitácora de auditoría; el documento no fue almacenado.',
        )
    # No hace falta db.refresh(doc): id y uploaded_at ya se generan en
    # Python (uuid.uuid4() / _utcnow()) antes del INSERT, así que el
    # objeto ya tiene todos sus valores sin necesidad de releerlos de la
    # base — un refresh explícito además correría en una transacción sin
    # contexto de tenant y RLS lo bloquearía.
    return _to_document_out(doc)


@router.get('', response_model=list[DocumentOut])
def list_documents(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_tenant_db)):
    # Filtra SIEMPRE por el company_id del token — nunca acepta un
    # company_id como parámetro de query o de ruta.
    #
    # No se audita: el listado solo devuelve metadatos, no abre ningún
    # documento. Lo que se audita como consulta es la descarga de un
    # documento concreto (download_document).
    docs = db.query(Document).filter(Document.company_id == current.company_id).all()
    return [_to_document_out(d) for d in docs]


def _documento_de_la_empresa(db: Session, doc_id: str, company_id: str) -> Document:
    doc = db.query(Document).filter(Document.id == doc_id, Document.company_id == company_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail='Documento no encontrado')
    return doc


def _metadatos_documento(doc: Document) -> dict:
    # El sha256 del archivo quedó registrado en el evento documento_subido
    # del mismo document_id; no se recalcula en cada consulta.
    return {
        'document_id': doc.id,
        'req_id': doc.req_id,
        'nombre_archivo': doc.filename,
        'tamano_bytes': doc.size_bytes,
        'content_type': doc.content_type,
    }


@router.get('/{doc_id}/download')
def download_document(
    doc_id: str,
    request: Request,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_tenant_db),
):
    doc = _documento_de_la_empresa(db, doc_id, current.company_id)

    ruta = Path(doc.stored_path).resolve()
    carpeta_empresa = (qs.STORAGE_DIR / current.company_id).resolve()
    # Defensa en profundidad: stored_path lo genera el servidor, pero nunca
    # se sirve un archivo fuera de la carpeta de la propia empresa.
    if carpeta_empresa not in ruta.parents or not ruta.is_file():
        logger.error('Archivo de documento %s ausente o fuera de su carpeta: %s', doc.id, ruta)
        raise HTTPException(status_code=404, detail='Documento no encontrado')

    # Fail-closed: el evento se confirma ANTES de entregar un solo byte. Si
    # la bitácora no responde, el documento no se entrega. (Si la
    # transferencia se corta después, el evento ya quedó: la bitácora puede
    # sobrerreportar una consulta, nunca omitirla.)
    try:
        audit.registrar_evento(
            db, audit.EVENTO_DOCUMENTO_CONSULTADO, 'exito',
            user_id=current.user_id, company_id=current.company_id, ip_origen=client_ip(request),
            detalle=_metadatos_documento(doc),
        )
        db.commit()
    except Exception:
        logger.exception('Descarga de documento %s bloqueada', doc.id)
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail='No se pudo registrar la consulta en la bitácora de auditoría; el documento no se entregó.',
        )

    safe_filename = sanitize_filename(doc.filename)
    return FileResponse(ruta, media_type=doc.content_type, filename=safe_filename)


@router.delete('/{doc_id}', status_code=204)
def delete_document(
    doc_id: str,
    request: Request,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_tenant_db),
):
    # Mismo criterio que la UI: solo el administrador gestiona documentos.
    if current.role != 'administrador':
        raise HTTPException(status_code=403, detail='Solo el administrador puede eliminar documentos')

    doc = _documento_de_la_empresa(db, doc_id, current.company_id)
    ruta = Path(doc.stored_path)
    detalle = _metadatos_documento(doc)

    # Orden inverso al de la subida: primero base + auditoría (commit) y
    # recién después el archivo en disco. Si la auditoría o el commit
    # fallan, el rollback restaura la fila y el archivo sigue intacto. Si lo
    # que falla es el borrado del archivo tras el commit, queda un archivo
    # sin Document asociado, que es exactamente lo que recoge
    # services/storage_cleanup.py.
    try:
        db.delete(doc)
        audit.registrar_evento(
            db, audit.EVENTO_DOCUMENTO_ELIMINADO, 'exito',
            user_id=current.user_id, company_id=current.company_id, ip_origen=client_ip(request),
            detalle=detalle,
        )
        db.commit()
    except Exception:
        logger.exception('Eliminación de documento %s revertida', doc_id)
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail='No se pudo registrar la eliminación en la bitácora de auditoría; el documento no fue eliminado.',
        )

    try:
        secure_delete(ruta)
    except Exception:
        # El documento ya está eliminado en base y auditado: no se revierte.
        # El archivo queda huérfano hasta la próxima limpieza.
        logger.exception('No se pudo borrar el archivo del documento %s; lo recogerá la limpieza de huérfanos', doc_id)
