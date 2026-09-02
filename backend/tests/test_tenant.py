from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from db.tenant import set_tenant_context


def test_set_tenant_context_es_no_op_en_sqlite():
    engine = create_engine('sqlite:///:memory:')
    Session = sessionmaker(bind=engine)
    db = Session()
    # No debe lanzar ni intentar ejecutar sintaxis de PostgreSQL contra SQLite.
    set_tenant_context(db, 'empresa-1')
    assert db.execute(text('SELECT 1')).scalar() == 1
    db.close()
