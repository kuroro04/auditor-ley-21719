import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from core.deps import CurrentUser, get_clamav_client, get_current_user, get_tenant_db
from db.models import Document
from models.schemas import DocumentOut
from services.secure_upload_service import process_secure_upload

router = APIRouter(prefix='/documents', tags=['documents'])


def _to_document_out(doc: Document) -> DocumentOut:
    return DocumentOut(
        id=doc.id, req_id=doc.req_id, filename=doc.filename,
        content_type=doc.content_type, size_bytes=doc.size_bytes,
        uploaded_at=doc.uploaded_at.isoformat(),
    )


@router.post('/upload', response_model=DocumentOut, status_code=201)
async def upload_document(
    req_id: str = Form(...),
    file: UploadFile = File(...),
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_tenant_db),
    clamav_client=Depends(get_clamav_client),
):
    content = await file.read()
    # Carga segura (Fase 4): cuarentena -> validación MIME/magic bytes ->
    # escaneo ClamAV -> almacenamiento definitivo. Fail-closed: si ClamAV
    # no responde, outcome.accepted queda en False igual que si estuviera
    # infectado.
    outcome = process_secure_upload(current.company_id, file.filename or 'archivo', content, clamav_client)
    if not outcome.accepted:
        raise HTTPException(status_code=400, detail=outcome.reason)

    doc = Document(
        id=str(uuid.uuid4()),
        company_id=current.company_id,
        req_id=req_id,
        filename=outcome.filename,
        stored_path=str(outcome.stored_path),
        content_type=file.content_type or 'application/octet-stream',
        size_bytes=len(content),
        uploaded_by=current.user_id,
    )
    db.add(doc)
    db.commit()
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
    docs = db.query(Document).filter(Document.company_id == current.company_id).all()
    return [_to_document_out(d) for d in docs]
