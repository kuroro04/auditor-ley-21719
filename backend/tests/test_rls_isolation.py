"""Prueba de aislamiento RLS contra PostgreSQL real (Supabase).

Se salta automáticamente si DATABASE_URL no apunta a PostgreSQL: el resto
de la suite sigue corriendo en SQLite en memoria sin tocar la base real.
Para correr esta prueba, backend/.env debe tener el DATABASE_URL del rol
app_user (el mismo que usa el backend en runtime).
"""
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from core.config import DATABASE_URL
from db.tenant import set_tenant_context

pytestmark = pytest.mark.skipif(
    not DATABASE_URL.startswith('postgresql'),
    reason='Requiere DATABASE_URL apuntando a PostgreSQL (rol app_user)',
)


@pytest.fixture()
def db():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    session.creadas: list[str] = []  # type: ignore[attr-defined]
    yield session
    for company_id in session.creadas:  # type: ignore[attr-defined]
        try:
            set_tenant_context(session, company_id)
            session.execute(text('DELETE FROM users WHERE company_id = :cid'), {'cid': company_id})
            session.execute(text('DELETE FROM companies WHERE id = :cid'), {'cid': company_id})
            session.commit()
        except Exception:
            session.rollback()
    session.close()
    engine.dispose()


def _crear_empresa_y_usuario(db, company_id: str, email: str) -> None:
    set_tenant_context(db, company_id)
    db.execute(
        text('INSERT INTO companies (id, rut, nombre) VALUES (:id, :rut, :nombre)'),
        {'id': company_id, 'rut': company_id[:8], 'nombre': f'Empresa {company_id[:8]}'},
    )
    db.execute(
        text(
            'INSERT INTO users (id, company_id, email, password_hash, role, onboarding_completed) '
            'VALUES (:id, :company_id, :email, :hash, :role, false)'
        ),
        {
            'id': str(uuid.uuid4()), 'company_id': company_id, 'email': email,
            'hash': 'x', 'role': 'administrador',
        },
    )
    db.commit()
    db.creadas.append(company_id)  # type: ignore[attr-defined]


def test_tenant_b_no_ve_usuarios_de_tenant_a(db):
    company_a = str(uuid.uuid4())
    company_b = str(uuid.uuid4())
    _crear_empresa_y_usuario(db, company_a, f'a-{uuid.uuid4()}@test.local')
    db.creadas.append(company_b)  # type: ignore[attr-defined]

    set_tenant_context(db, company_b)
    filas = db.execute(
        text('SELECT * FROM users WHERE company_id = :cid'), {'cid': company_a}
    ).fetchall()
    assert filas == []


def test_sin_contexto_de_tenant_no_se_ve_ninguna_fila(db):
    company_a = str(uuid.uuid4())
    _crear_empresa_y_usuario(db, company_a, f'sin-ctx-{uuid.uuid4()}@test.local')

    # Nueva transacción sin haber llamado a set_tenant_context.
    filas = db.execute(text('SELECT * FROM users')).fetchall()
    assert filas == []


def test_insert_con_company_id_ajeno_al_contexto_falla(db):
    company_a = str(uuid.uuid4())
    company_b = str(uuid.uuid4())

    set_tenant_context(db, company_a)
    db.execute(
        text('INSERT INTO companies (id, rut, nombre) VALUES (:id, :rut, :nombre)'),
        {'id': company_b, 'rut': company_b[:8], 'nombre': 'Empresa B'},
    )
    db.commit()
    db.creadas.extend([company_a, company_b])  # type: ignore[attr-defined]

    with pytest.raises(Exception):
        db.execute(
            text(
                'INSERT INTO users (id, company_id, email, password_hash, role, onboarding_completed) '
                'VALUES (:id, :company_id, :email, :hash, :role, false)'
            ),
            {
                'id': str(uuid.uuid4()), 'company_id': company_b,
                'email': f'cruzado-{uuid.uuid4()}@test.local', 'hash': 'x', 'role': 'administrador',
            },
        )
        db.commit()
    db.rollback()
