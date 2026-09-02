# Fase 3: PostgreSQL + Row-Level Security — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar DataShield de SQLite a PostgreSQL (Supabase) manteniendo compatibilidad con SQLite para tests, y agregar Row-Level Security como segunda capa de aislamiento multi-tenant a nivel de base de datos.

**Architecture:** Dos roles de Postgres (`postgres` admin solo para setup, `app_user` sin `BYPASSRLS` para runtime). Contexto de tenant por transacción vía `SELECT set_config('app.current_company_id', ..., true)`, fijado por una nueva dependencia FastAPI `get_tenant_db`. Políticas RLS en `users`/`documents` comparan `company_id` contra ese contexto. Dos excepciones controladas y documentadas: `/auth/register` fija el contexto tras crear la empresa antes de insertar el usuario; `/auth/login` usa una función SQL `SECURITY DEFINER` (`get_user_by_email`) para la única búsqueda que legítimamente debe cruzar tenants (buscar por email antes de saber la empresa).

**Tech Stack:** FastAPI, SQLAlchemy 2.0, psycopg2-binary, PostgreSQL (Supabase), pytest.

**Spec:** `docs/superpowers/specs/2026-09-01-postgresql-rls-design.md`

## Global Constraints

- La contraseña de Postgres (admin o app_user) NUNCA se escribe en código ni se commitea; solo vive en `backend/.env` (gitignorado) o como variable de entorno de proceso al ejecutar el script de setup.
- El código debe volver a funcionar con SQLite solo cambiando `DATABASE_URL` (para tests locales) — todo lo específico de Postgres debe ser un no-op en SQLite.
- No romper los tests existentes (siguen en SQLite en memoria) ni el frontend.
- Comentarios en español.
- El venv del backend está en `backend/venv` (Python 3.11.9, SQLAlchemy 2.0.52 ya instalado). Todos los comandos de este plan usan `backend/venv/Scripts/python.exe` y `backend/venv/Scripts/pip.exe`.

---

### Task 1: Agregar driver de PostgreSQL

**Files:**
- Modify: `backend/requirements.txt`

**Interfaces:**
- Produces: paquete `psycopg2` importable en el venv.

- [ ] **Step 1: Agregar la dependencia**

En `backend/requirements.txt`, agregar al final:

```
psycopg2-binary>=2.9.9
```

- [ ] **Step 2: Instalar en el venv**

Run: `backend/venv/Scripts/pip.exe install -r backend/requirements.txt`
Expected: instala `psycopg2-binary` sin errores.

- [ ] **Step 3: Verificar el import**

Run: `backend/venv/Scripts/python.exe -c "import psycopg2; print(psycopg2.__version__)"`
Expected: imprime una versión (ej. `2.9.x (dt dec pq3 ext lo64)`), sin traceback.

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: agregar psycopg2-binary para PostgreSQL"
```

---

### Task 2: Helper de contexto de tenant (`db/tenant.py`)

**Files:**
- Create: `backend/db/tenant.py`
- Test: `backend/tests/test_tenant.py`

**Interfaces:**
- Produces: `set_tenant_context(db: Session, company_id: str) -> None`, `find_user_by_email(db: Session, email: str) -> User | None` (ambas en `db/tenant.py`).
- Consumes: `db.models.User`.

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/tests/test_tenant.py`:

```python
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
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_tenant.py -v` (desde la raíz del repo, con `cd backend` primero o usando `PYTHONPATH=backend`)

Concretamente: `cd backend && venv/Scripts/python.exe -m pytest tests/test_tenant.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'db.tenant'`.

- [ ] **Step 3: Implementar `db/tenant.py`**

```python
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
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `cd backend && venv/Scripts/python.exe -m pytest tests/test_tenant.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/db/tenant.py backend/tests/test_tenant.py
git commit -m "feat: helper de contexto de tenant para RLS (no-op en SQLite)"
```

---

### Task 3: Dependencia FastAPI `get_tenant_db`

**Files:**
- Modify: `backend/core/deps.py`

**Interfaces:**
- Consumes: `get_db` (de `db.database`), `CurrentUser`/`get_current_user` (ya existentes en este archivo), `set_tenant_context` (Task 2).
- Produces: `get_tenant_db(db: Session = Depends(get_db), current: CurrentUser = Depends(get_current_user)) -> Session`.

- [ ] **Step 1: Agregar el import y la dependencia**

En `backend/core/deps.py`, agregar a los imports:

```python
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from db.database import get_db
from db.tenant import set_tenant_context
```

Y al final del archivo:

```python
def get_tenant_db(
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
) -> Session:
    """Como get_db, pero además fija el tenant activo para las políticas RLS.

    Los routers que atienden a un usuario ya autenticado deben depender de
    esta función (en vez de get_db a secas) para que RLS tenga el contexto
    correcto en esa transacción.
    """
    set_tenant_context(db, current.company_id)
    return db
```

- [ ] **Step 2: Verificar que el módulo importa sin errores**

Run: `cd backend && venv/Scripts/python.exe -c "import core.deps"`
Expected: sin traceback.

- [ ] **Step 3: Correr la suite completa en SQLite (regresión)**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q`
Expected: todos los tests existentes siguen en PASS (get_tenant_db aún no se usa en ningún router).

- [ ] **Step 4: Commit**

```bash
git add backend/core/deps.py
git commit -m "feat: dependencia get_tenant_db (get_db + contexto RLS)"
```

---

### Task 4: Usar `get_tenant_db` en rutas ya autenticadas

**Files:**
- Modify: `backend/routers/documents.py`
- Modify: `backend/routers/auth.py:95-116` (`/me`, `/complete-onboarding`)

**Interfaces:**
- Consumes: `get_tenant_db` (Task 3).

- [ ] **Step 1: `documents.py` — cambiar el import y las dos rutas**

Cambiar:

```python
from core.deps import CurrentUser, get_current_user
from db.database import get_db
```

por:

```python
from core.deps import CurrentUser, get_current_user, get_tenant_db
```

Y en ambas funciones (`upload_document`, `list_documents`), cambiar `db: Session = Depends(get_db)` por `db: Session = Depends(get_tenant_db)`. `get_db` deja de usarse en este archivo, se puede quitar el import.

- [ ] **Step 2: `auth.py` — `/me` y `/complete-onboarding`**

En `backend/routers/auth.py`, en las funciones `me` y `complete_onboarding` (líneas ~95-116), cambiar `db: Session = Depends(get_db)` por `db: Session = Depends(get_tenant_db)`. Actualizar el import:

```python
from core.deps import CurrentUser, get_current_user, get_tenant_db
```

(`/register` y `/login` siguen usando `get_db` a secas — se resuelven en las Tasks 5 y 6.)

- [ ] **Step 3: Correr la suite completa en SQLite**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q`
Expected: todos los tests PASS (en SQLite, `get_tenant_db` es equivalente a `get_db` porque `set_tenant_context` es no-op).

- [ ] **Step 4: Commit**

```bash
git add backend/routers/documents.py backend/routers/auth.py
git commit -m "feat: usar get_tenant_db en rutas autenticadas (documents, /me, /complete-onboarding)"
```

---

### Task 5: `/auth/register` fija el contexto de tenant

**Files:**
- Modify: `backend/routers/auth.py:34-73`

**Interfaces:**
- Consumes: `set_tenant_context` (Task 2).

- [ ] **Step 1: Agregar el import**

```python
from db.tenant import set_tenant_context
```

- [ ] **Step 2: Modificar `register` para fijar el contexto antes de insertar el usuario**

Reemplazar el cuerpo desde la creación de `company` hasta `db.commit()`:

```python
    company_id = str(uuid.uuid4())
    company = Company(
        id=company_id, rut=rut_normalizado, nombre=payload.nombre_empresa, sector=payload.sector,
    )
    db.add(company)

    # Fija el contexto de tenant ANTES de insertar el primer usuario: la
    # política RLS de `users` exige que company_id coincida con el
    # contexto de la transacción, incluso para el INSERT.
    set_tenant_context(db, company_id)

    user = User(
        id=str(uuid.uuid4()), company_id=company_id, email=email_normalizado,
        password_hash=hash_password(payload.password), role='administrador',
    )
    db.add(user)
    db.commit()

    token = create_access_token(user.id, company_id, user.role)
    _set_session_cookie(response, token)
    return SessionResponse(
        email=user.email, role=user.role, company_id=company_id,
        company_nombre=company.nombre, company_sector=company.sector,
        onboarding_completed=user.onboarding_completed,
    )
```

(Nota: antes se usaba `company.id`; ahora se usa la variable `company_id` que ya conocemos de antemano porque `Company.id` se pasa explícito, no autogenerado en el INSERT.)

- [ ] **Step 3: Correr la suite completa en SQLite**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q`
Expected: `tests/test_auth_register.py` y el resto siguen en PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/routers/auth.py
git commit -m "feat: /auth/register fija contexto de tenant antes del INSERT del usuario"
```

---

### Task 6: `/auth/login` usa `find_user_by_email`

**Files:**
- Modify: `backend/routers/auth.py:76-92`

**Interfaces:**
- Consumes: `find_user_by_email`, `set_tenant_context` (Task 2).

- [ ] **Step 1: Agregar el import**

```python
from db.tenant import find_user_by_email, set_tenant_context
```

(se puede combinar con el import de la Task 5 en una sola línea)

- [ ] **Step 2: Modificar `login`**

```python
@router.post('/login', response_model=SessionResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email_normalizado = payload.email.lower()
    user = find_user_by_email(db, email_normalizado)
    # Mensaje genérico a propósito: no revela si falló el correo o la
    # contraseña, para no ayudar a un atacante a enumerar correos válidos.
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail='Correo o contraseña incorrectos')

    set_tenant_context(db, user.company_id)
    company = db.query(Company).filter(Company.id == user.company_id).first()
    token = create_access_token(user.id, user.company_id, user.role)
    _set_session_cookie(response, token)
    return SessionResponse(
        email=user.email, role=user.role, company_id=company.id,
        company_nombre=company.nombre, company_sector=company.sector,
        onboarding_completed=user.onboarding_completed,
    )
```

- [ ] **Step 3: Correr la suite completa en SQLite**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q`
Expected: todos los tests PASS, incluido `tests/test_auth_login.py`.

- [ ] **Step 4: Commit**

```bash
git add backend/routers/auth.py
git commit -m "feat: /auth/login usa find_user_by_email (compatible con RLS)"
```

---

### Task 7: SQL de RLS documentado (`rls_policies.sql`)

**Files:**
- Create: `backend/db/rls_policies.sql`

No lleva contraseñas ni datos sensibles — es 100% seguro de commitear. La creación del rol `app_user` (que sí necesita una contraseña) va aparte, en el script de la Task 8.

- [ ] **Step 1: Escribir el archivo**

```sql
-- Row-Level Security para aislamiento multi-tenant (Fase 3).
-- Se aplica una sola vez con el rol admin (postgres), vía backend/db/setup_rls.py.
-- El rol app_user (creado por separado, con contraseña) es el único que la
-- app usa en runtime, y NO tiene BYPASSRLS, así que estas políticas sí le
-- aplican de verdad.

-- 1. Permisos mínimos del rol de aplicación sobre las tablas.
GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON companies, users, documents TO app_user;

-- 2. Activar RLS en las tablas con datos por tenant.
--    `companies` queda fuera a propósito: es el registro de tenants, no
--    datos de un tenant, y cada usuario ya solo consulta su propia empresa
--    por un id que conoce desde su JWT.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 3. Política: una fila solo es visible/editable si su company_id coincide
--    con el tenant fijado en la transacción actual (vía
--    SELECT set_config('app.current_company_id', ..., true) en
--    backend/db/tenant.py). Si no se fijó ningún contexto,
--    current_setting(..., true) devuelve NULL y la comparación es NULL
--    (falsy): no se ve ni se puede insertar ninguna fila.
DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users
    USING (company_id = current_setting('app.current_company_id', true))
    WITH CHECK (company_id = current_setting('app.current_company_id', true));

DROP POLICY IF EXISTS tenant_isolation_documents ON documents;
CREATE POLICY tenant_isolation_documents ON documents
    USING (company_id = current_setting('app.current_company_id', true))
    WITH CHECK (company_id = current_setting('app.current_company_id', true));

-- 4. Única excepción controlada a RLS: buscar un usuario por email antes de
--    saber su company_id (necesario para /auth/login). SECURITY DEFINER
--    hace que la función corra con los privilegios de su dueño (el rol
--    admin), no los de app_user, así que puede leer `users` sin contexto de
--    tenant — pero SOLO a través de esta función, con exactamente estas
--    columnas. app_user no tiene permiso para hacer SELECT en `users` sin
--    contexto de ninguna otra forma.
CREATE OR REPLACE FUNCTION get_user_by_email(p_email text)
RETURNS TABLE (
    id text, company_id text, email text, password_hash text,
    role text, onboarding_completed boolean, created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, company_id, email, password_hash, role, onboarding_completed, created_at
    FROM users
    WHERE email = p_email;
$$;

REVOKE ALL ON FUNCTION get_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_by_email(text) TO app_user;
```

- [ ] **Step 2: Commit**

```bash
git add backend/db/rls_policies.sql
git commit -m "docs: SQL de políticas RLS documentado (aplicado por setup_rls.py)"
```

---

### Task 8: Script administrativo de setup (`setup_rls.py`)

**Files:**
- Create: `backend/db/setup_rls.py`

**Interfaces:**
- Consumes: `backend/db/rls_policies.sql` (Task 7), `Base`/`models` (ya existentes), variables de entorno de proceso `DATABASE_URL_ADMIN` y `APP_USER_PASSWORD` (nunca en `.env`).

- [ ] **Step 1: Escribir el script**

```python
"""Script de configuración administrativa para PostgreSQL/Supabase (Fase 3).

Se ejecuta A MANO, una sola vez (o cada vez que cambien las políticas),
usando el rol `postgres` (superusuario) de Supabase. Nunca se ejecuta como
parte del arranque normal del backend, y su connection string admin NUNCA
se guarda en backend/.env — solo se pasa como variable de entorno de
proceso al momento de correr este script.

Uso (PowerShell):
    $env:DATABASE_URL_ADMIN = "postgresql://postgres:...@host:5432/postgres"
    $env:APP_USER_PASSWORD = "<password-generada-para-app_user>"
    backend/venv/Scripts/python.exe -m db.setup_rls

Es idempotente: se puede correr de nuevo sin duplicar nada (crea el rol
solo si no existe, y las políticas/función se reemplazan con
DROP POLICY IF EXISTS / CREATE OR REPLACE FUNCTION).
"""
import os
from pathlib import Path

import psycopg2
from psycopg2 import sql
from sqlalchemy import create_engine

from db.database import Base
from db import models  # noqa: F401 — registra los modelos en Base antes de create_all

RLS_SQL_PATH = Path(__file__).resolve().parent / 'rls_policies.sql'


def main() -> None:
    admin_url = os.environ['DATABASE_URL_ADMIN']
    app_password = os.environ['APP_USER_PASSWORD']

    print('1/3 Creando tablas (si no existen)...')
    engine = create_engine(admin_url)
    Base.metadata.create_all(bind=engine)
    engine.dispose()

    conn = psycopg2.connect(admin_url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            print('2/3 Creando/actualizando el rol app_user...')
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = 'app_user'")
            existe = cur.fetchone() is not None
            verbo = 'ALTER ROLE' if existe else 'CREATE ROLE'
            cur.execute(
                sql.SQL(verbo + ' app_user WITH LOGIN PASSWORD {}').format(
                    sql.Literal(app_password)
                )
            )

            print('3/3 Aplicando permisos, RLS y políticas (rls_policies.sql)...')
            cur.execute(RLS_SQL_PATH.read_text(encoding='utf-8'))

        print('Listo.')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Verificar que el módulo importa sin errores (sin ejecutar `main`)**

Run: `cd backend && venv/Scripts/python.exe -c "import db.setup_rls"`
Expected: sin traceback (no requiere las variables de entorno solo para importar, porque `os.environ[...]` está dentro de `main()`).

- [ ] **Step 3: Commit**

```bash
git add backend/db/setup_rls.py
git commit -m "feat: script administrativo setup_rls.py (crea tablas, rol app_user y políticas RLS)"
```

---

### Task 9: Ejecutar el setup contra Supabase real y configurar `backend/.env`

**Files:**
- Modify: `backend/.env` (no se commitea — está en `.gitignore`)

**Interfaces:**
- Consumes: `backend/db/setup_rls.py` (Task 8), la connection string real de Supabase (provista por el usuario en el chat, nunca escrita en un archivo del repo).

- [ ] **Step 1: Generar una contraseña aleatoria fuerte para `app_user`**

Run (ejemplo): `venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(24))"`

- [ ] **Step 2: Correr `setup_rls.py` contra Supabase, con la connection string admin y la contraseña generada como variables de entorno de proceso (nunca escritas a disco)**

Run: `DATABASE_URL_ADMIN="postgresql://postgres:<password-admin-real>@db.enqznajyencuaqltgbfl.supabase.co:5432/postgres" APP_USER_PASSWORD="<password-generada>" backend/venv/Scripts/python.exe -m db.setup_rls`
Expected: imprime `1/3`, `2/3`, `3/3 ... Listo.` sin errores.

- [ ] **Step 3: Actualizar `backend/.env`**

Cambiar la línea `DATABASE_URL=sqlite:///./backend.db` por:

```
DATABASE_URL=postgresql://app_user:<password-generada>@db.enqznajyencuaqltgbfl.supabase.co:5432/postgres
```

Dejar el resto de `backend/.env` (`SECRET_KEY`, `FRONTEND_ORIGIN`, `COOKIE_SECURE`) igual.

- [ ] **Step 4: Confirmar que `.env` sigue ignorado por git**

Run: `git status --short backend/.env`
Expected: sin salida (git no lo detecta como modificado para commitear, porque `.env` está en `.gitignore`).

(Este task no termina en un `git commit` — nada de lo que cambia aquí se commitea.)

---

### Task 10: Verificar el backend contra PostgreSQL real

**Files:** ninguno (task de verificación en vivo, no de código)

- [ ] **Step 1: Arrancar el backend contra Supabase**

Run: `cd backend && venv/Scripts/python.exe -m uvicorn main:app --port 8000` (en segundo plano)
Expected: arranca sin errores, `Base.metadata.create_all()` no falla (las tablas ya existen, creadas por `setup_rls.py`).

- [ ] **Step 2: Flujo completo con curl — registrar empresa**

```bash
curl -s -c cookies.txt -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"rut":"76.123.456-7","nombre_empresa":"Empresa Demo","email":"demo@test.local","password":"password123"}'
```

Expected: 201, JSON con `company_id`, `role: "administrador"`.

- [ ] **Step 3: Login**

```bash
curl -s -c cookies.txt -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"password123"}'
```

Expected: 200, mismo `company_id` que en el registro (confirma que `find_user_by_email` funciona contra Postgres vía `get_user_by_email`).

- [ ] **Step 4: Subir documento**

```bash
curl -s -b cookies.txt -X POST http://localhost:8000/documents/upload \
  -F "req_id=req-1" -F "file=@backend/requirements.txt"
```

Expected: 201, JSON con `id`, `filename`.

- [ ] **Step 5: Listar documentos**

```bash
curl -s -b cookies.txt http://localhost:8000/documents
```

Expected: 200, array con el documento subido en el paso anterior.

- [ ] **Step 6: Detener el backend**

Terminar el proceso de uvicorn iniciado en el Step 1.

---

### Task 11: Test de aislamiento RLS contra PostgreSQL real

**Files:**
- Create: `backend/tests/test_rls_isolation.py`

**Interfaces:**
- Consumes: `set_tenant_context` (Task 2), `core.config.DATABASE_URL`.

- [ ] **Step 1: Escribir el test**

```python
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
```

- [ ] **Step 2: Correr el test contra Postgres real**

Run: `cd backend && venv/Scripts/python.exe -m pytest tests/test_rls_isolation.py -v`
Expected: 3 tests en PASS (requiere que `backend/.env` ya tenga el `DATABASE_URL` de `app_user` de la Task 9).

- [ ] **Step 3: Confirmar que se salta correctamente en SQLite**

Run: `cd backend && TESTING=1 DATABASE_URL=sqlite:///:memory: venv/Scripts/python.exe -m pytest tests/test_rls_isolation.py -v`
Expected: 3 tests en SKIPPED (razón: "Requiere DATABASE_URL apuntando a PostgreSQL").

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_rls_isolation.py
git commit -m "test: aislamiento RLS multi-tenant contra PostgreSQL real"
```

---

### Task 12: Regresión final completa

**Files:** ninguno

- [ ] **Step 1: Suite completa tal cual queda configurada (contra Postgres real)**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q`
Expected: todos PASS. `conftest.py` solo hace override de `get_db` a nivel de FastAPI para los tests que usan el fixture `client` (esos siguen corriendo 100% en SQLite en memoria, aislados). `core.config.DATABASE_URL` se lee de `backend/.env` al importar el módulo; como esa variable ahora apunta a Postgres (Task 9), los tests de `test_rls_isolation.py` SÍ corren contra Supabase real — que es justo lo pedido: "el RLS pruébalo contra PostgreSQL".

- [ ] **Step 2: Confirmar que sigue siendo posible correr todo en SQLite (sin tocar Postgres)**

Run: `cd backend && DATABASE_URL=sqlite:///:memory: venv/Scripts/python.exe -m pytest -q`
Expected: todos PASS, y los 3 tests de `test_rls_isolation.py` quedan en SKIPPED (razón: "Requiere DATABASE_URL apuntando a PostgreSQL"). Esto confirma la compatibilidad hacia atrás pedida en las restricciones.

- [ ] **Step 3: Confirmar que no quedó ningún secreto en el árbol de git**

Run: `git status --short` y `git diff --cached --stat`
Expected: `backend/.env` no aparece en ningún listado; los únicos archivos nuevos/modificados son código, `rls_policies.sql`, tests y docs.

- [ ] **Step 4: Commit final (si queda algo pendiente)**

```bash
git add -A
git status --short
```

Revisar la salida antes de commitear cualquier cosa adicional — no debe incluir `backend/.env` ni ningún archivo con la contraseña real.
