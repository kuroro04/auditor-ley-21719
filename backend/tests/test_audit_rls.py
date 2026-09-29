"""Prueba las políticas RLS de audit_log contra PostgreSQL real (Supabase).

Se salta automáticamente si DATABASE_URL no apunta a PostgreSQL, igual que
test_rls_isolation.py. A diferencia de esa prueba, ningún caso hace commit:
audit_log es append-only a propósito (app_user no tiene UPDATE ni DELETE,
ver db/rls_policies.sql #5), así que no hay forma de "limpiar" filas
insertadas ni tendría sentido dejar eventos de prueba en una bitácora que
se supone íntegra. Cada caso corre dentro de una transacción que siempre
termina en rollback — Postgres evalúa el WITH CHECK de RLS al ejecutar el
INSERT, no al hacer commit, así que la aserción no necesita persistir nada.
"""
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.config import DATABASE_URL
from db.tenant import set_tenant_context
from services import audit

pytestmark = pytest.mark.skipif(
    not DATABASE_URL.startswith('postgresql'),
    reason='Requiere DATABASE_URL apuntando a PostgreSQL (rol app_user)',
)


@pytest.fixture()
def db():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()
    engine.dispose()


def test_insert_con_company_id_null_pasa_sin_contexto_de_tenant(db):
    """Caso login fallido: nunca se llama set_tenant_context."""
    registro = audit.registrar_evento(
        db, audit.EVENTO_LOGIN_FALLIDO, 'fallo', detalle={'email_intentado': 'x@test.cl'},
    )
    assert registro is not None
    assert registro.company_id is None


def test_insert_con_company_id_del_tenant_activo_pasa(db):
    tenant = str(uuid.uuid4())
    set_tenant_context(db, tenant)

    registro = audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'exito', company_id=tenant)

    assert registro is not None
    assert registro.company_id == tenant


def test_insert_con_company_id_no_nulo_sin_contexto_de_tenant_es_bloqueado(db):
    """El bug que se corrigió en routers/auth.py: si algún endpoint nuevo
    olvida llamar set_tenant_context antes de un evento con company_id no
    nulo, RLS debe bloquear el INSERT. Como el evento no es crítico,
    registrar_evento no relanza: devuelve None (y queda rastro en el log
    de la aplicación) en vez de tumbar la operación."""
    registro = audit.registrar_evento(
        db, audit.EVENTO_LOGIN_EXITOSO, 'exito', company_id=str(uuid.uuid4()),
    )
    assert registro is None


def test_insert_con_company_id_de_otro_tenant_es_bloqueado(db):
    set_tenant_context(db, str(uuid.uuid4()))

    registro = audit.registrar_evento(
        db, audit.EVENTO_LOGIN_EXITOSO, 'exito', company_id=str(uuid.uuid4()),
    )

    assert registro is None


def test_insert_con_company_id_no_nulo_en_evento_critico_relanza(db):
    """Mismo bloqueo de RLS, pero en un evento de EVENTOS_CRITICOS: acá sí
    debe relanzar, para que la operación que llama no se ejecute."""
    with pytest.raises(Exception):
        audit.registrar_evento(
            db, audit.EVENTO_DOCUMENTO_SUBIDO, 'exito', company_id=str(uuid.uuid4()),
            detalle={'filename': 'x.pdf', 'file_hash': 'abc', 'veredicto': 'limpio'},
        )


def test_select_no_ve_eventos_de_otro_tenant_ni_eventos_globales(db):
    tenant_propio = str(uuid.uuid4())
    tenant_ajeno = str(uuid.uuid4())

    set_tenant_context(db, tenant_ajeno)
    audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'exito', company_id=tenant_ajeno)
    audit.registrar_evento(db, audit.EVENTO_LOGIN_FALLIDO, 'fallo')  # company_id NULL

    set_tenant_context(db, tenant_propio)
    propio = audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'exito', company_id=tenant_propio)
    assert propio is not None

    visibles = db.query(audit.AuditLog).all()

    ids_visibles = {fila.id for fila in visibles}
    assert propio.id in ids_visibles
    assert all(fila.company_id == tenant_propio for fila in visibles)
