"""Aislamiento multi-tenant a nivel de base de datos (RLS de PostgreSQL).

En SQLite (usado en tests locales) todo este módulo es no-op: el
aislamiento ahí sigue siendo responsabilidad exclusiva de la capa de
aplicación (filtros por company_id en cada router), igual que antes de
esta fase.
"""
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.models import User


def set_tenant_context(db: Session, company_id: str) -> None:
    """Fija el tenant activo para las políticas RLS de la transacción actual.

    Usa set_config(..., is_local=true) en vez de `SET LOCAL ... = :valor`
    porque PostgreSQL no admite parámetros bindeados dentro de `SET`; con
    set_config sí, así que el company_id nunca se concatena a mano en el
    SQL. is_local=true limita el efecto a la transacción en curso
    (equivalente a SET LOCAL): no puede "filtrarse" a la siguiente request
    aunque SQLAlchemy reutilice la misma conexión del pool.
    """
    if db.get_bind().dialect.name != 'postgresql':
        return
    db.execute(
        text("SELECT set_config('app.current_company_id', :company_id, true)"),
        {'company_id': company_id},
    )


def find_user_by_email(db: Session, email: str) -> User | None:
    """Busca un usuario por email para el login.

    El email es único a nivel global (no por empresa), así que esta
    búsqueda ocurre necesariamente ANTES de saber el company_id del
    usuario: no hay contexto de tenant que fijar todavía. Bajo RLS
    estricto, una consulta directa a `users` en ese momento siempre
    devolvería 0 filas.

    En PostgreSQL se resuelve con la función SQL `get_user_by_email`
    (ver `backend/db/rls_policies.sql`), creada como SECURITY DEFINER:
    corre con los privilegios de su dueño (el rol admin), no los de quien
    la llama, y es la única excepción controlada a RLS de todo el
    sistema, acotada a devolver exactamente las columnas que necesita el
    login. En SQLite (tests) esa función no existe ni hace falta: se usa
    una consulta ORM normal.
    """
    if db.get_bind().dialect.name != 'postgresql':
        return db.query(User).filter(User.email == email).first()

    row = db.execute(
        text('SELECT * FROM get_user_by_email(:email)'), {'email': email}
    ).mappings().first()
    if row is None:
        return None
    return User(**dict(row))
