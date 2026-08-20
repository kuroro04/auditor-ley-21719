import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from core.config import STORAGE_DIR
from core.deps import CurrentUser, get_current_user
from db.database import get_db
from db.models import Document
from models.schemas import DocumentOut
from services.file_security_service import check_file_security, sanitize_filename

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
    db: Session = Depends(get_db),
):
    content = await file.read()
    result = check_file_security(file.filename or '', len(content), content[:8])
    if not result.accepted:
        raise HTTPException(status_code=400, detail=result.reason)

    safe_name = sanitize_filename(file.filename or 'archivo')
    company_dir = STORAGE_DIR / current.company_id
    company_dir.mkdir(parents=True, exist_ok=True)
    stored_path = company_dir / f'{uuid.uuid4()}_{safe_name}'
    stored_path.write_bytes(content)

    doc = Document(
        id=str(uuid.uuid4()),
        company_id=current.company_id,
        req_id=req_id,
        filename=safe_name,
        stored_path=str(stored_path),
        content_type=file.content_type or 'application/octet-stream',
        size_bytes=len(content),
        uploaded_by=current.user_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _to_document_out(doc)


@router.get('', response_model=list[DocumentOut])
def list_documents(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    # Filtra SIEMPRE por el company_id del token — nunca acepta un
    # company_id como parámetro de query o de ruta.
    docs = db.query(Document).filter(Document.company_id == current.company_id).all()
    return [_to_document_out(d) for d in docs]
