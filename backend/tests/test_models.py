import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from db.database import Base
from db.models import Company, User, Document


def _memory_session():
    engine = create_engine(
        'sqlite:///:memory:',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def test_crear_empresa_usuario_y_documento_relacionados():
    db = _memory_session()

    company = Company(id=str(uuid.uuid4()), rut='111111111', nombre='Empresa Test', sector='tecnologia')
    db.add(company)
    db.flush()

    user = User(
        id=str(uuid.uuid4()), company_id=company.id, email='admin@test.cl',
        password_hash='hash', role='administrador',
    )
    db.add(user)
    db.flush()

    doc = Document(
        id=str(uuid.uuid4()), company_id=company.id, req_id='politica_privacidad',
        filename='politica.pdf', stored_path='/tmp/politica.pdf',
        content_type='application/pdf', size_bytes=123, uploaded_by=user.id,
    )
    db.add(doc)
    db.commit()

    stored = db.query(Document).filter(Document.company_id == company.id).all()
    assert len(stored) == 1
    assert stored[0].filename == 'politica.pdf'
    assert stored[0].uploaded_by == user.id


def test_rut_de_empresa_es_unico():
    db = _memory_session()
    db.add(Company(id=str(uuid.uuid4()), rut='111111111', nombre='A'))
    db.commit()
    db.add(Company(id=str(uuid.uuid4()), rut='111111111', nombre='B'))
    try:
        db.commit()
        assert False, 'debia lanzar error de unicidad'
    except Exception:
        db.rollback()
