# Backend FastAPI (Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el primer backend real de DataShield (FastAPI + SQLite) que maneja registro de empresas, login con JWT en cookie httpOnly, y recepción/listado de documentos aislados por empresa, y conectarlo al frontend Next.js existente sin romper el análisis local.

**Architecture:** Backend FastAPI en `backend/` (proceso Python separado, puerto 8000), con SQLAlchemy sobre SQLite (`backend/backend.db`) y sesión de usuario en una cookie httpOnly firmada con JWT. El frontend Next.js (puerto 3000) habla con él vía `fetch(..., { credentials: 'include' })` desde una capa `lib/api/`. El motor de reglas y la capa semántica del cliente no cambian: la subida al backend ocurre en paralelo a la extracción local de texto, sin bloquearla.

**Tech Stack:** FastAPI, SQLAlchemy 2.x, SQLite, PyJWT, bcrypt, pytest + httpx (backend). Next.js 14 / React 18 / TypeScript, Vitest (frontend, ya existente).

## Global Constraints

- Ninguna contraseña se guarda ni se loguea en texto plano — siempre hasheada con bcrypt.
- El `company_id` y el `role` de cada request al backend salen siempre del JWT de la cookie de sesión, nunca de un parámetro que el cliente controle.
- El JWT viaja en una cookie `httpOnly` — nunca en `localStorage`/`sessionStorage` ni en un header que el JS del frontend deba manejar manualmente.
- Registrar un RUT que ya existe devuelve `409` (nunca une automáticamente al nuevo usuario a la empresa existente): *"Esta empresa ya está registrada. Si perteneces a ella, solicita a tu administrador que te dé acceso."*
- `DATABASE_URL` y `SECRET_KEY` viven en `backend/.env`, nunca hardcodeadas en el código.
- Comentarios de código en español, siguiendo el estilo ya usado en el resto del proyecto.
- El motor de reglas (`lib/analyzer.ts`) y la capa semántica (`lib/semantic/`) no se modifican — el análisis sigue 100% en el cliente.
- No se rompe el modo demostración (`onDemo`), que sigue siendo una simulación 100% local sin tocar el backend.

---

### Task 1: Scaffold del backend + healthcheck

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/pytest.ini`
- Create: `backend/main.py`
- Create: `backend/tests/test_health.py`

**Interfaces:**
- Produces: app FastAPI mínima (`backend/main.py: app`) con `GET /health` → `{"status": "ok"}`. Usada por todos los routers de tareas posteriores (`app.include_router(...)`).

- [ ] **Step 1: Crear requirements.txt**

Crear `backend/requirements.txt`:

```
fastapi>=0.115.0
uvicorn[standard]>=0.34.0
sqlalchemy>=2.0.36
pyjwt>=2.10.1
bcrypt>=4.2.0
python-multipart>=0.0.20
python-dotenv>=1.0.1
email-validator>=2.2.0
pytest>=8.3.0
httpx>=0.28.0
```

- [ ] **Step 2: Crear .env.example y .gitignore**

Crear `backend/.env.example`:

```
SECRET_KEY=change-me-in-production-use-a-long-random-string
DATABASE_URL=sqlite:///./backend.db
FRONTEND_ORIGIN=http://localhost:3000
COOKIE_SECURE=false
```

Crear `backend/.gitignore`:

```
venv/
__pycache__/
*.pyc
*.db
storage/
.env
.pytest_cache/
```

- [ ] **Step 3: Crear pytest.ini**

Crear `backend/pytest.ini` (asegura que `from core...`, `from db...`, etc. resuelvan sin importar desde dónde se invoque pytest):

```ini
[pytest]
pythonpath = .
```

- [ ] **Step 4: Crear el entorno virtual e instalar dependencias**

Run: `cd backend && python -m venv venv`
Run (Windows/PowerShell): `venv\Scripts\Activate.ps1` — (Bash/git-bash: `source venv/Scripts/activate`)
Run: `pip install -r requirements.txt`
Expected: instala todo sin errores.

- [ ] **Step 5: Escribir el test del healthcheck (falla porque main.py no existe aún)**

Crear `backend/tests/test_health.py`:

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_devuelve_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
```

- [ ] **Step 6: Correr el test para verificar que falla**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_health.py -v` (o `python -m pytest tests/test_health.py -v` con el venv activado)
Expected: FAIL — `ModuleNotFoundError: No module named 'main'`.

- [ ] **Step 7: Crear main.py mínimo**

Crear `backend/main.py`:

```python
from fastapi import FastAPI

app = FastAPI(title="DataShield API", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 8: Correr el test para verificar que pasa**

Run: `python -m pytest tests/test_health.py -v`
Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add backend/requirements.txt backend/.env.example backend/.gitignore backend/pytest.ini backend/main.py backend/tests/test_health.py
git commit -m "chore: scaffold del backend FastAPI con healthcheck"
```

(El propio `backend/venv/` queda ignorado por `backend/.gitignore` — no se commitea.)

---

### Task 2: Validación de RUT chileno (módulo 11)

**Files:**
- Create: `backend/services/__init__.py` (vacío)
- Create: `backend/services/rut_service.py`
- Test: `backend/tests/test_rut_service.py`

**Interfaces:**
- Produces: `is_valid_rut(raw: str) -> bool`, `normalize_rut(raw: str) -> str`. Usadas por `routers/auth.py` (Task 6).

- [ ] **Step 1: Escribir el test (falla, el módulo no existe)**

Crear `backend/tests/test_rut_service.py`:

```python
from services.rut_service import is_valid_rut, normalize_rut


def test_rut_valido_con_puntos_y_guion():
    assert is_valid_rut('11.111.111-1') is True


def test_rut_valido_sin_formato():
    assert is_valid_rut('111111111') is True


def test_rut_con_digito_verificador_incorrecto():
    assert is_valid_rut('11.111.111-2') is False


def test_rut_con_formato_invalido():
    assert is_valid_rut('abc') is False
    assert is_valid_rut('123') is False


def test_normalize_rut_quita_puntos_guion_espacios_y_pone_mayusculas():
    assert normalize_rut(' 11.111.111-1 ') == '111111111'
    assert normalize_rut('7.654.321-k') == '7654321K'
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `python -m pytest tests/test_rut_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'services'`.

- [ ] **Step 3: Implementar rut_service.py**

Crear `backend/services/__init__.py` (vacío).

Crear `backend/services/rut_service.py`:

```python
import re

# Espejo en Python de isValidRut en components/LoginCard.tsx — mismo
# algoritmo de módulo 11, para que el backend valide el RUT con la misma
# regla que ya se muestra al usuario en el formulario del frontend.


def normalize_rut(raw: str) -> str:
    return re.sub(r'[.\-\s]', '', raw).upper()


def is_valid_rut(raw: str) -> bool:
    clean = normalize_rut(raw)
    if not re.fullmatch(r'\d{7,8}[0-9K]', clean):
        return False

    body, dv_input = clean[:-1], clean[-1]
    total = 0
    multiplier = 2
    for digit in reversed(body):
        total += int(digit) * multiplier
        multiplier = 2 if multiplier == 7 else multiplier + 1

    remainder = 11 - (total % 11)
    dv_expected = '0' if remainder == 11 else 'K' if remainder == 10 else str(remainder)
    return dv_input == dv_expected
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `python -m pytest tests/test_rut_service.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/__init__.py backend/services/rut_service.py backend/tests/test_rut_service.py
git commit -m "feat(backend): validacion de RUT chileno (modulo 11)"
```

---

### Task 3: Hash de contraseñas y JWT

**Files:**
- Create: `backend/core/__init__.py` (vacío)
- Create: `backend/core/config.py`
- Create: `backend/core/security.py`
- Test: `backend/tests/test_security.py`

**Interfaces:**
- Produces: `config.SECRET_KEY`, `config.ALGORITHM`, `config.ACCESS_TOKEN_EXPIRE_MINUTES`, `config.DATABASE_URL`, `config.FRONTEND_ORIGIN`, `config.COOKIE_SECURE`, `config.STORAGE_DIR`; `hash_password(password: str) -> str`, `verify_password(password: str, password_hash: str) -> bool`, `create_access_token(user_id: str, company_id: str, role: str) -> str`, `decode_access_token(token: str) -> dict`.
- Consumes: nada nuevo (usa `python-dotenv`, `bcrypt`, `pyjwt` ya instalados en Task 1).

- [ ] **Step 1: Escribir el test (falla, los módulos no existen)**

Crear `backend/tests/test_security.py`:

```python
import time

import jwt
import pytest

from core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from core import config


def test_hash_password_nunca_devuelve_el_texto_plano():
    hashed = hash_password('Clave-Segura123!')
    assert hashed != 'Clave-Segura123!'
    assert verify_password('Clave-Segura123!', hashed) is True


def test_verify_password_rechaza_contrasena_incorrecta():
    hashed = hash_password('Clave-Segura123!')
    assert verify_password('otra-clave', hashed) is False


def test_create_and_decode_access_token_conserva_claims():
    token = create_access_token(user_id='u1', company_id='c1', role='administrador')
    payload = decode_access_token(token)
    assert payload['sub'] == 'u1'
    assert payload['company_id'] == 'c1'
    assert payload['role'] == 'administrador'


def test_decode_access_token_rechaza_token_expirado():
    expired = jwt.encode(
        {'sub': 'u1', 'company_id': 'c1', 'role': 'administrador', 'exp': time.time() - 10},
        config.SECRET_KEY,
        algorithm=config.ALGORITHM,
    )
    with pytest.raises(jwt.PyJWTError):
        decode_access_token(expired)
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `python -m pytest tests/test_security.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'core'`.

- [ ] **Step 3: Implementar core/config.py y core/security.py**

Crear `backend/core/__init__.py` (vacío).

Crear `backend/core/config.py`:

```python
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Nunca hardcodear el secreto real: en desarrollo cae a un valor de ejemplo,
# pero en producción SIEMPRE debe venir de backend/.env (ver .env.example).
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-change-me')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 horas

DATABASE_URL = os.getenv('DATABASE_URL', f"sqlite:///{BASE_DIR / 'backend.db'}")
FRONTEND_ORIGIN = os.getenv('FRONTEND_ORIGIN', 'http://localhost:3000')
# En producción (HTTPS) debe ser 'true' para que la cookie solo viaje por TLS.
COOKIE_SECURE = os.getenv('COOKIE_SECURE', 'false').lower() == 'true'

STORAGE_DIR = BASE_DIR / 'storage'
```

Crear `backend/core/security.py`:

```python
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from core import config


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def create_access_token(user_id: str, company_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {'sub': user_id, 'company_id': company_id, 'role': role, 'exp': expire}
    return jwt.encode(payload, config.SECRET_KEY, algorithm=config.ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `python -m pytest tests/test_security.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/core/__init__.py backend/core/config.py backend/core/security.py backend/tests/test_security.py
git commit -m "feat(backend): hash de contrasenas (bcrypt) y JWT de sesion"
```

---

### Task 4: Modelos de datos (SQLAlchemy)

**Files:**
- Create: `backend/db/__init__.py` (vacío)
- Create: `backend/db/database.py`
- Create: `backend/db/models.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Produces: `Base`, `engine`, `get_db()` (generador de sesión); modelos ORM `Company`, `User`, `Document`.
- Consumes: `core.config.DATABASE_URL` (Task 3).

- [ ] **Step 1: Escribir el test (falla, el módulo no existe)**

Crear `backend/tests/test_models.py`:

```python
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
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `python -m pytest tests/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'db'`.

- [ ] **Step 3: Implementar db/database.py y db/models.py**

Crear `backend/db/__init__.py` (vacío).

Crear `backend/db/database.py`:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from core.config import DATABASE_URL

# check_same_thread=False: SQLite por defecto solo permite usar la conexión
# desde el hilo que la abrió; FastAPI puede atender cada request en un hilo
# distinto, así que hace falta relajar esa restricción aquí.
connect_args = {'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Crear `backend/db/models.py`:

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from db.database import Base


def new_id() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Company(Base):
    __tablename__ = 'companies'

    id = Column(String, primary_key=True, default=new_id)
    rut = Column(String, unique=True, nullable=False, index=True)
    nombre = Column(String, nullable=False)
    sector = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    users = relationship('User', back_populates='company')
    documents = relationship('Document', back_populates='company')


class User(Base):
    __tablename__ = 'users'

    id = Column(String, primary_key=True, default=new_id)
    company_id = Column(String, ForeignKey('companies.id'), nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow)

    company = relationship('Company', back_populates='users')


class Document(Base):
    __tablename__ = 'documents'

    id = Column(String, primary_key=True, default=new_id)
    company_id = Column(String, ForeignKey('companies.id'), nullable=False, index=True)
    req_id = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    uploaded_by = Column(String, ForeignKey('users.id'), nullable=False)
    uploaded_at = Column(DateTime, default=_utcnow)

    company = relationship('Company', back_populates='documents')
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `python -m pytest tests/test_models.py -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/db/__init__.py backend/db/database.py backend/db/models.py backend/tests/test_models.py
git commit -m "feat(backend): modelos SQLAlchemy Company/User/Document"
```

---

### Task 5: Fixture compartida de tests con base de datos en memoria

**Files:**
- Create: `backend/tests/conftest.py`

**Interfaces:**
- Produces: fixture `client` (TestClient de FastAPI con `get_db` sobreescrito a SQLite en memoria, fresca por test). La usarán las Tasks 6, 7 y 9.
- Consumes: `db.database.Base`, `db.database.get_db` (Task 4); `main.app` (Task 1, se amplía en Task 10).

- [ ] **Step 1: Crear conftest.py**

Crear `backend/tests/conftest.py`:

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main as main_module
from db.database import Base, get_db


@pytest.fixture()
def client():
    # Cada test recibe su propia base SQLite en memoria, aislada de
    # backend.db (la base "real") y de los demás tests.
    engine = create_engine(
        'sqlite:///:memory:',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main_module.app.dependency_overrides[get_db] = override_get_db
    with TestClient(main_module.app) as test_client:
        yield test_client
    main_module.app.dependency_overrides.clear()
```

- [ ] **Step 2: Verificar que las fixtures cargan sin error**

Run: `python -m pytest tests/test_health.py -v`
Expected: PASS (1 test) — confirma que `conftest.py` no rompe la suite existente aunque ningún test todavía use la fixture `client`.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/conftest.py
git commit -m "test(backend): fixture de TestClient con base SQLite en memoria"
```

---

### Task 6: `POST /auth/register`

**Files:**
- Create: `backend/models/__init__.py` (vacío)
- Create: `backend/models/schemas.py`
- Create: `backend/routers/__init__.py` (vacío)
- Create: `backend/routers/auth.py`
- Modify: `backend/main.py`
- Test: `backend/tests/test_auth_register.py`

**Interfaces:**
- Consumes: `is_valid_rut`/`normalize_rut` (Task 2), `hash_password`/`create_access_token` (Task 3), `Company`/`User`/`get_db` (Task 4), fixture `client` (Task 5).
- Produces: `router` (`APIRouter(prefix='/auth')`) con `POST /register`; Pydantic `RegisterRequest`, `SessionResponse`. Reutilizado por Task 7 (login/me) y Task 9 (documents, vía `core/deps.py` que se crea en Task 7).

- [ ] **Step 1: Escribir el test (falla, el endpoint no existe)**

Crear `backend/tests/test_auth_register.py`:

```python
def test_registro_exitoso_crea_admin_y_setea_cookie(client):
    res = client.post('/auth/register', json={
        'rut': '11.111.111-1',
        'nombre_empresa': 'Empresa Test',
        'email': 'admin@empresatest.cl',
        'password': 'Clave-Segura123!',
        'sector': 'tecnologia',
    })
    assert res.status_code == 201
    body = res.json()
    assert body['role'] == 'administrador'
    assert body['company_nombre'] == 'Empresa Test'
    assert body['company_sector'] == 'tecnologia'
    assert body['email'] == 'admin@empresatest.cl'
    assert 'access_token' in res.cookies


def test_rut_invalido_devuelve_400():
    pass  # se reemplaza en el siguiente test parametrizado


def test_registro_con_rut_invalido_devuelve_400(client):
    res = client.post('/auth/register', json={
        'rut': '11.111.111-2',  # dígito verificador incorrecto
        'nombre_empresa': 'Empresa Test',
        'email': 'admin@empresatest.cl',
        'password': 'Clave-Segura123!',
    })
    assert res.status_code == 400


def test_registrar_rut_ya_existente_devuelve_409_y_no_crea_segundo_admin(client):
    payload = {
        'rut': '11.111.111-1',
        'nombre_empresa': 'Empresa Test',
        'email': 'admin@empresatest.cl',
        'password': 'Clave-Segura123!',
    }
    primero = client.post('/auth/register', json=payload)
    assert primero.status_code == 201

    segundo = client.post('/auth/register', json={**payload, 'email': 'otro@empresatest.cl'})
    assert segundo.status_code == 409
    assert 'ya está registrada' in segundo.json()['detail']


def test_registrar_email_ya_existente_devuelve_409(client):
    payload = {
        'rut': '11.111.111-1',
        'nombre_empresa': 'Empresa Test',
        'email': 'admin@empresatest.cl',
        'password': 'Clave-Segura123!',
    }
    client.post('/auth/register', json=payload)

    res = client.post('/auth/register', json={**payload, 'rut': '22.222.222-2'})
    assert res.status_code == 409
```

(La función vacía `test_rut_invalido_devuelve_400` se elimina en el paso de implementación — quedó como recordatorio de nombre, el test real está en `test_registro_con_rut_invalido_devuelve_400`.)

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `python -m pytest tests/test_auth_register.py -v`
Expected: FAIL — `404 Not Found` en `/auth/register` (el router no existe todavía) o `ModuleNotFoundError`.

- [ ] **Step 3: Quitar el test vacío del archivo**

En `backend/tests/test_auth_register.py`, eliminar la función:

```python
def test_rut_invalido_devuelve_400():
    pass  # se reemplaza en el siguiente test parametrizado
```

- [ ] **Step 4: Implementar schemas.py y routers/auth.py (solo /register por ahora)**

Crear `backend/models/__init__.py` (vacío).

Crear `backend/models/schemas.py`:

```python
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    rut: str
    nombre_empresa: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)
    sector: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SessionResponse(BaseModel):
    email: str
    role: str
    company_id: str
    company_nombre: str
    company_sector: Optional[str] = None


class DocumentOut(BaseModel):
    id: str
    req_id: str
    filename: str
    content_type: str
    size_bytes: int
    uploaded_at: str
```

Crear `backend/routers/__init__.py` (vacío).

Crear `backend/routers/auth.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from core.config import COOKIE_SECURE
from core.security import create_access_token, hash_password
from db.database import get_db
from db.models import Company, User
from models.schemas import RegisterRequest, SessionResponse
from services.rut_service import is_valid_rut, normalize_rut

router = APIRouter(prefix='/auth', tags=['auth'])

COOKIE_NAME = 'access_token'
COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8  # 8 horas, igual que ACCESS_TOKEN_EXPIRE_MINUTES


def _set_session_cookie(response: Response, token: str) -> None:
    # httpOnly: el JavaScript del navegador nunca puede leer ni robar este
    # valor (a diferencia de localStorage/sessionStorage, que cualquier script
    # que corra en la página -incluido uno inyectado por XSS- sí puede leer).
    # El navegador la reenvía solo en cada request al backend gracias a
    # credentials:'include' en el fetch del frontend.
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite='lax',
        secure=COOKIE_SECURE,
        max_age=COOKIE_MAX_AGE_SECONDS,
        path='/',
    )


@router.post('/register', response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    if not is_valid_rut(payload.rut):
        raise HTTPException(status_code=400, detail='RUT inválido')

    rut_normalizado = normalize_rut(payload.rut)
    email_normalizado = payload.email.lower()

    if db.query(Company).filter(Company.rut == rut_normalizado).first():
        # No se une automáticamente al usuario a la empresa existente: el RUT
        # es información pública en Chile, así que auto-unirse solo con el
        # RUT sería un hueco de seguridad. Incorporar usuarios a una empresa
        # ya registrada es responsabilidad de su administrador (flujo de
        # "invitar usuarios" queda para una fase futura).
        raise HTTPException(
            status_code=409,
            detail='Esta empresa ya está registrada. Si perteneces a ella, solicita a tu administrador que te dé acceso.',
        )
    if db.query(User).filter(User.email == email_normalizado).first():
        raise HTTPException(status_code=409, detail='Ese correo ya está registrado')

    company = Company(
        id=str(uuid.uuid4()), rut=rut_normalizado, nombre=payload.nombre_empresa, sector=payload.sector,
    )
    db.add(company)

    user = User(
        id=str(uuid.uuid4()), company_id=company.id, email=email_normalizado,
        password_hash=hash_password(payload.password), role='administrador',
    )
    db.add(user)
    db.commit()

    token = create_access_token(user.id, company.id, user.role)
    _set_session_cookie(response, token)
    return SessionResponse(
        email=user.email, role=user.role, company_id=company.id,
        company_nombre=company.nombre, company_sector=company.sector,
    )
```

- [ ] **Step 5: Montar el router en main.py**

En `backend/main.py`, reemplazar:

```python
from fastapi import FastAPI

app = FastAPI(title="DataShield API", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok"}
```

por:

```python
from fastapi import FastAPI

from routers import auth

app = FastAPI(title="DataShield API", version="0.1.0")

app.include_router(auth.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Correr el test para verificar que pasa**

Run: `python -m pytest tests/test_auth_register.py -v`
Expected: PASS (4 tests).

- [ ] **Step 7: Correr toda la suite para confirmar que nada se rompió**

Run: `python -m pytest -v`
Expected: PASS en todos los archivos de `tests/`.

- [ ] **Step 8: Commit**

```bash
git add backend/models/__init__.py backend/models/schemas.py backend/routers/__init__.py backend/routers/auth.py backend/main.py backend/tests/test_auth_register.py
git commit -m "feat(backend): POST /auth/register con rechazo 409 de RUT duplicado"
```

---

### Task 7: `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`

**Files:**
- Create: `backend/core/deps.py`
- Modify: `backend/routers/auth.py`
- Test: `backend/tests/test_auth_login.py`

**Interfaces:**
- Produces: `CurrentUser` (dataclass: `user_id`, `company_id`, `role`), `get_current_user(request: Request) -> CurrentUser` (dependency). Usada por `routers/documents.py` (Task 9).
- Consumes: `decode_access_token` (Task 3), `verify_password` (Task 3), router de Task 6.

- [ ] **Step 1: Escribir el test (falla, los endpoints no existen)**

Crear `backend/tests/test_auth_login.py`:

```python
def _registrar(client, email='admin@empresatest.cl'):
    return client.post('/auth/register', json={
        'rut': '11.111.111-1',
        'nombre_empresa': 'Empresa Test',
        'email': email,
        'password': 'Clave-Segura123!',
        'sector': 'tecnologia',
    })


def test_login_con_credenciales_correctas_devuelve_sesion(client):
    _registrar(client)
    res = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': 'Clave-Segura123!'})
    assert res.status_code == 200
    body = res.json()
    assert body['role'] == 'administrador'
    assert body['company_nombre'] == 'Empresa Test'
    assert 'access_token' in res.cookies


def test_login_con_password_incorrecta_devuelve_401(client):
    _registrar(client)
    res = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': 'incorrecta'})
    assert res.status_code == 401


def test_login_con_email_inexistente_devuelve_401(client):
    res = client.post('/auth/login', json={'email': 'nadie@empresatest.cl', 'password': 'lo-que-sea'})
    assert res.status_code == 401


def test_me_sin_cookie_devuelve_401(client):
    res = client.get('/auth/me')
    assert res.status_code == 401


def test_me_con_sesion_devuelve_datos_del_usuario(client):
    _registrar(client)
    client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': 'Clave-Segura123!'})
    res = client.get('/auth/me')
    assert res.status_code == 200
    assert res.json()['email'] == 'admin@empresatest.cl'


def test_logout_borra_la_cookie_de_sesion(client):
    _registrar(client)
    client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': 'Clave-Segura123!'})
    res = client.post('/auth/logout')
    assert res.status_code == 204

    me_despues = client.get('/auth/me')
    assert me_despues.status_code == 401
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `python -m pytest tests/test_auth_login.py -v`
Expected: FAIL — `404 Not Found` en `/auth/login`.

- [ ] **Step 3: Implementar core/deps.py**

Crear `backend/core/deps.py`:

```python
from dataclasses import dataclass

import jwt
from fastapi import HTTPException, Request, status

from core.security import decode_access_token
from routers.auth import COOKIE_NAME


@dataclass
class CurrentUser:
    user_id: str
    company_id: str
    role: str


def get_current_user(request: Request) -> CurrentUser:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='No autenticado')
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Sesión inválida o expirada')
    return CurrentUser(user_id=payload['sub'], company_id=payload['company_id'], role=payload['role'])
```

- [ ] **Step 4: Agregar login/me/logout a routers/auth.py**

En `backend/routers/auth.py`, cambiar el bloque de imports del encabezado de:

```python
from core.config import COOKIE_SECURE
from core.security import create_access_token, hash_password
from db.database import get_db
from db.models import Company, User
from models.schemas import RegisterRequest, SessionResponse
from services.rut_service import is_valid_rut, normalize_rut
```

a:

```python
from core.config import COOKIE_SECURE
from core.deps import CurrentUser, get_current_user
from core.security import create_access_token, hash_password, verify_password
from db.database import get_db
from db.models import Company, User
from models.schemas import LoginRequest, RegisterRequest, SessionResponse
from services.rut_service import is_valid_rut, normalize_rut
```

Al final del archivo (después de la función `register`), agregar:

```python
@router.post('/login', response_model=SessionResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email_normalizado = payload.email.lower()
    user = db.query(User).filter(User.email == email_normalizado).first()
    # Mensaje genérico a propósito: no revela si falló el correo o la
    # contraseña, para no ayudar a un atacante a enumerar correos válidos.
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail='Correo o contraseña incorrectos')

    company = db.query(Company).filter(Company.id == user.company_id).first()
    token = create_access_token(user.id, user.company_id, user.role)
    _set_session_cookie(response, token)
    return SessionResponse(
        email=user.email, role=user.role, company_id=company.id,
        company_nombre=company.nombre, company_sector=company.sector,
    )


@router.get('/me', response_model=SessionResponse)
def me(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == current.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail='Sesión inválida')
    company = db.query(Company).filter(Company.id == user.company_id).first()
    return SessionResponse(
        email=user.email, role=user.role, company_id=company.id,
        company_nombre=company.nombre, company_sector=company.sector,
    )


@router.post('/logout', status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path='/')
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `python -m pytest tests/test_auth_login.py -v`
Expected: PASS (6 tests).

- [ ] **Step 6: Correr toda la suite**

Run: `python -m pytest -v`
Expected: PASS en todos los archivos.

- [ ] **Step 7: Commit**

```bash
git add backend/core/deps.py backend/routers/auth.py backend/tests/test_auth_login.py
git commit -m "feat(backend): POST /auth/login, GET /auth/me, POST /auth/logout"
```

---

### Task 8: Validación de seguridad de archivos (magic bytes)

**Files:**
- Create: `backend/services/file_security_service.py`
- Test: `backend/tests/test_file_security_service.py`

**Interfaces:**
- Produces: `check_file_security(filename: str, size: int, header: bytes) -> FileSecurityResult` (dataclass con `accepted: bool`, `reason: str`), `sanitize_filename(name: str) -> str`. Usadas por `routers/documents.py` (Task 9).
- Espejo en Python de `lib/fileSecurity.ts` (mismas extensiones permitidas/peligrosas, mismas firmas binarias, mismo límite de 50MB).

- [ ] **Step 1: Escribir el test (falla, el módulo no existe)**

Crear `backend/tests/test_file_security_service.py`:

```python
from services.file_security_service import MAX_FILE_SIZE_BYTES, check_file_security, sanitize_filename

PDF_HEADER = bytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])  # %PDF-1.4
ZIP_HEADER = bytes([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])  # docx/xlsx
OLE_HEADER = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])  # doc/xls
EXE_HEADER = bytes([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])  # MZ (Windows PE)


def test_acepta_pdf_real():
    result = check_file_security('doc.pdf', 1024, PDF_HEADER)
    assert result.accepted is True


def test_acepta_docx_real():
    result = check_file_security('doc.docx', 1024, ZIP_HEADER)
    assert result.accepted is True


def test_acepta_doc_legado_real():
    result = check_file_security('doc.doc', 1024, OLE_HEADER)
    assert result.accepted is True


def test_rechaza_ejecutable_disfrazado_de_pdf():
    result = check_file_security('doc.pdf', 1024, EXE_HEADER)
    assert result.accepted is False
    assert 'ejecutable' in result.reason


def test_rechaza_extension_peligrosa():
    result = check_file_security('script.exe', 1024, EXE_HEADER)
    assert result.accepted is False


def test_rechaza_extension_no_soportada():
    result = check_file_security('imagen.png', 1024, bytes(8))
    assert result.accepted is False


def test_rechaza_archivo_vacio():
    result = check_file_security('doc.pdf', 0, b'')
    assert result.accepted is False


def test_rechaza_archivo_que_supera_el_limite():
    result = check_file_security('doc.pdf', MAX_FILE_SIZE_BYTES + 1, PDF_HEADER)
    assert result.accepted is False


def test_rechaza_doble_extension_peligrosa():
    result = check_file_security('documento.pdf.exe', 1024, PDF_HEADER)
    assert result.accepted is False


def test_rechaza_txt_que_en_realidad_es_binario():
    result = check_file_security('notas.txt', 1024, PDF_HEADER)
    assert result.accepted is False


def test_sanitize_filename_quita_rutas_y_caracteres_de_control():
    assert sanitize_filename('../../etc/passwd.pdf') == 'passwd.pdf'
    assert sanitize_filename('C:\\Users\\a\\archivo.pdf') == 'archivo.pdf'
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `python -m pytest tests/test_file_security_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'services.file_security_service'`.

- [ ] **Step 3: Implementar file_security_service.py**

Crear `backend/services/file_security_service.py`:

```python
import re
from dataclasses import dataclass

# Espejo en Python de lib/fileSecurity.ts — mismas extensiones permitidas,
# extensiones peligrosas, firmas binarias y límite de tamaño, para que el
# backend rechace exactamente lo mismo que ya rechaza el cliente.

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

DANGEROUS_EXTENSIONS = {
    'exe', 'js', 'mjs', 'cjs', 'bat', 'cmd', 'sh', 'msi', 'msc', 'scr',
    'vbs', 'vbe', 'ps1', 'psm1', 'jar', 'com', 'pif', 'gadget', 'hta',
    'wsf', 'wsh', 'lnk', 'reg', 'apk', 'dmg', 'app', 'dll', 'sys', 'jse',
}

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx'}

SIGNATURES = {
    'pdf': bytes([0x25, 0x50, 0x44, 0x46]),
    'zip': bytes([0x50, 0x4b, 0x03, 0x04]),
    'ole2': bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    'exe_pe': bytes([0x4d, 0x5a]),
    'elf': bytes([0x7f, 0x45, 0x4c, 0x46]),
}


@dataclass
class FileSecurityResult:
    accepted: bool
    reason: str


def _matches_signature(header: bytes, signature: bytes) -> bool:
    return len(header) >= len(signature) and header[: len(signature)] == signature


def sanitize_filename(name: str) -> str:
    base = re.split(r'[\\/]', name)[-1]
    sin_control = re.sub(r'[\x00-\x1f\x7f]', '', base)
    cleaned = re.sub(r'\s+', ' ', sin_control).strip()
    return cleaned or 'archivo'


def _get_extension(name: str) -> str:
    parts = name.rsplit('.', 1)
    return parts[-1].lower() if len(parts) > 1 else ''


def _has_dangerous_double_extension(name: str) -> bool:
    parts = name.lower().split('.')
    if len(parts) < 3:
        return False
    return any(p in DANGEROUS_EXTENSIONS for p in parts[1:-1])


def check_file_security(filename: str, size: int, header: bytes) -> FileSecurityResult:
    ext = _get_extension(filename)

    if size == 0:
        return FileSecurityResult(False, 'El archivo está vacío')
    if size > MAX_FILE_SIZE_BYTES:
        return FileSecurityResult(False, 'El archivo supera el límite de 50 MB')
    if ext in DANGEROUS_EXTENSIONS:
        return FileSecurityResult(False, f'Extensión peligrosa no permitida (.{ext})')
    if ext not in ALLOWED_EXTENSIONS:
        return FileSecurityResult(False, f"Tipo de archivo no soportado (.{ext or 'sin extensión'})")
    if _has_dangerous_double_extension(filename):
        return FileSecurityResult(False, 'Nombre de archivo con doble extensión sospechosa')

    if _matches_signature(header, SIGNATURES['exe_pe']) or _matches_signature(header, SIGNATURES['elf']):
        return FileSecurityResult(False, 'El contenido del archivo corresponde a un ejecutable, no a un documento')

    if ext == 'pdf' and not _matches_signature(header, SIGNATURES['pdf']):
        return FileSecurityResult(False, 'El contenido del archivo no coincide con un PDF válido')
    if ext in ('docx', 'xlsx') and not _matches_signature(header, SIGNATURES['zip']):
        return FileSecurityResult(False, 'El contenido del archivo no coincide con un documento Office válido')
    if ext in ('doc', 'xls') and not _matches_signature(header, SIGNATURES['ole2']):
        return FileSecurityResult(False, 'El contenido del archivo no coincide con un documento Office (formato antiguo) válido')
    if ext == 'txt':
        is_binary_disguised = (
            _matches_signature(header, SIGNATURES['pdf'])
            or _matches_signature(header, SIGNATURES['zip'])
            or _matches_signature(header, SIGNATURES['ole2'])
        )
        if is_binary_disguised:
            return FileSecurityResult(False, 'El archivo .txt en realidad contiene un formato binario')

    return FileSecurityResult(True, 'Archivo aceptado — validación de tipo y contenido correcta')
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `python -m pytest tests/test_file_security_service.py -v`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/file_security_service.py backend/tests/test_file_security_service.py
git commit -m "feat(backend): validacion de archivos por magic bytes (espejo de lib/fileSecurity.ts)"
```

---

### Task 9: `POST /documents/upload` y `GET /documents`

**Files:**
- Create: `backend/routers/documents.py`
- Modify: `backend/main.py`
- Modify: `backend/models/schemas.py` (ya tiene `DocumentOut`, sin cambios de contenido — se referencia aquí como dependencia)
- Test: `backend/tests/test_documents.py`

**Interfaces:**
- Consumes: `check_file_security`/`sanitize_filename` (Task 8), `get_current_user`/`CurrentUser` (Task 7), `Document` (Task 4), `STORAGE_DIR` (Task 3), `DocumentOut` (Task 6).
- Produces: `router` (`APIRouter(prefix='/documents')`) con `POST /upload` y `GET ''`.

- [ ] **Step 1: Escribir el test (falla, el endpoint no existe)**

Crear `backend/tests/test_documents.py`:

```python
import io


def _registrar_y_login(client, rut, email):
    client.post('/auth/register', json={
        'rut': rut, 'nombre_empresa': f'Empresa {rut}', 'email': email,
        'password': 'Clave-Segura123!', 'sector': 'tecnologia',
    })


PDF_BYTES = b'%PDF-1.4\n%mock pdf content for tests\n'


def test_subir_documento_valido(client):
    _registrar_y_login(client, '11.111.111-1', 'admin@a.cl')
    res = client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
    )
    assert res.status_code == 201
    body = res.json()
    assert body['req_id'] == 'politica_privacidad'
    assert body['filename'] == 'politica.pdf'
    assert body['size_bytes'] == len(PDF_BYTES)


def test_subir_documento_sin_sesion_devuelve_401(client):
    res = client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
    )
    assert res.status_code == 401


def test_subir_archivo_rechazado_por_magic_bytes_devuelve_400(client):
    _registrar_y_login(client, '11.111.111-1', 'admin@a.cl')
    res = client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('falso.pdf', io.BytesIO(b'esto no es un pdf real'), 'application/pdf')},
    )
    assert res.status_code == 400


def test_listar_documentos_de_la_propia_empresa(client):
    _registrar_y_login(client, '11.111.111-1', 'admin@a.cl')
    client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
    )
    res = client.get('/documents')
    assert res.status_code == 200
    docs = res.json()
    assert len(docs) == 1
    assert docs[0]['filename'] == 'politica.pdf'


def test_empresa_b_no_ve_documentos_de_empresa_a(client):
    _registrar_y_login(client, '11.111.111-1', 'admin@a.cl')
    client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
    )
    client.post('/auth/logout')

    _registrar_y_login(client, '22.222.222-2', 'admin@b.cl')
    res = client.get('/documents')
    assert res.status_code == 200
    assert res.json() == []
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `python -m pytest tests/test_documents.py -v`
Expected: FAIL — `404 Not Found` en `/documents/upload`.

- [ ] **Step 3: Implementar routers/documents.py**

Crear `backend/routers/documents.py`:

```python
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
```

- [ ] **Step 4: Montar el router en main.py**

En `backend/main.py`, cambiar:

```python
from fastapi import FastAPI

from routers import auth

app = FastAPI(title="DataShield API", version="0.1.0")

app.include_router(auth.router)
```

a:

```python
from fastapi import FastAPI

from routers import auth, documents

app = FastAPI(title="DataShield API", version="0.1.0")

app.include_router(auth.router)
app.include_router(documents.router)
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `python -m pytest tests/test_documents.py -v`
Expected: PASS (5 tests).

- [ ] **Step 6: Correr toda la suite del backend**

Run: `python -m pytest -v`
Expected: PASS en todos los archivos (health, rut_service, security, models, auth_register, auth_login, file_security_service, documents).

- [ ] **Step 7: Commit**

```bash
git add backend/routers/documents.py backend/main.py backend/tests/test_documents.py
git commit -m "feat(backend): POST /documents/upload y GET /documents aislados por company_id"
```

---

### Task 10: CORS, creación de tablas al iniciar, y README del backend

**Files:**
- Modify: `backend/main.py`
- Create: `backend/README.md`

**Interfaces:** ninguna nueva — conecta lo ya construido (Tasks 1–9) para que `uvicorn main:app` funcione end-to-end contra `backend.db` real.

- [ ] **Step 1: Agregar CORS y creación de tablas en el startup**

En `backend/main.py`, reemplazar todo el archivo por:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import FRONTEND_ORIGIN, STORAGE_DIR
from db.database import Base, engine
from db import models  # noqa: F401 — registra los modelos en Base antes de create_all
from routers import auth, documents

app = FastAPI(title="DataShield API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    # Obligatorio para que la cookie httpOnly de sesión viaje en las
    # peticiones fetch(..., { credentials: 'include' }) del frontend.
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth.router)
app.include_router(documents.router)


@app.on_event('startup')
def on_startup():
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)


@app.get('/health')
def health():
    return {'status': 'ok'}
```

- [ ] **Step 2: Crear backend/README.md**

Crear `backend/README.md`:

```markdown
# DataShield API (backend)

Backend FastAPI de la Fase 2: registro/login de empresas y recepción de
documentos, con sesión en cookie httpOnly y aislamiento por `company_id`.
Almacenamiento en SQLite (`backend.db`) — se migrará a PostgreSQL en la
Fase 3 cambiando solo `DATABASE_URL`.

## Levantar el backend

```bash
cd backend
python -m venv venv

# Windows (PowerShell)
venv\Scripts\Activate.ps1
# Bash / git-bash
source venv/Scripts/activate

pip install -r requirements.txt
cp .env.example .env   # ajustar SECRET_KEY antes de ir a producción

uvicorn main:app --reload --port 8000
```

La API queda disponible en `http://localhost:8000` (docs interactivas en
`http://localhost:8000/docs`).

## Correr los tests

```bash
cd backend
python -m pytest -v
```

## Endpoints

| Método | Ruta               | Auth | Descripción                                      |
|--------|--------------------|------|---------------------------------------------------|
| POST   | `/auth/register`   | No   | Registra empresa + primer usuario (admin). 409 si el RUT ya existe. |
| POST   | `/auth/login`      | No   | Inicia sesión, setea cookie `access_token`.        |
| GET    | `/auth/me`         | Sí   | Datos del usuario autenticado.                     |
| POST   | `/auth/logout`     | Sí   | Cierra sesión (borra la cookie).                   |
| POST   | `/documents/upload`| Sí   | Sube un documento (`file` + `req_id`, multipart).  |
| GET    | `/documents`       | Sí   | Lista los documentos de la empresa de la sesión.   |

## Notas de seguridad

- Contraseñas: hasheadas con bcrypt, nunca en texto plano.
- Sesión: JWT en cookie `httpOnly` + `SameSite=Lax` — el frontend nunca lee
  el token directamente, así un XSS no puede robarlo.
- CSRF: no implementado en esta fase (queda documentado como pendiente para
  una fase posterior; `SameSite=Lax` ya mitiga el caso más común).
- Los archivos subidos se validan por extensión Y por firma binaria (magic
  bytes) antes de guardarse — ver `services/file_security_service.py`.
```

- [ ] **Step 3: Verificar el arranque real (no solo tests)**

Run: `cd backend && uvicorn main:app --port 8000 &` (o en una terminal aparte sin `&` en Windows)
Run: `curl http://localhost:8000/health`
Expected: `{"status":"ok"}`. Verificar que se creó `backend/backend.db` y `backend/storage/`.
Run: detener el servidor (Ctrl+C, o `kill %1` si se usó `&`).

- [ ] **Step 4: Commit**

```bash
git add backend/main.py backend/README.md
git commit -m "feat(backend): CORS, creacion de tablas al iniciar, y README de arranque"
```

---

### Task 11: Cliente HTTP del frontend (`lib/api/client.ts`) + CSP

**Files:**
- Create: `lib/api/client.ts`
- Modify: `next.config.mjs`
- Test: `__tests__/apiClient.test.ts`

**Interfaces:**
- Produces: `class ApiError extends Error { status: number }`, `apiRequest<T>(path: string, options?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T>`. Usada por `lib/api/auth.ts` y `lib/api/documents.ts` (Task 12).

- [ ] **Step 1: Escribir el test (falla, el módulo no existe)**

Crear `__tests__/apiClient.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiRequest, ApiError } from '../lib/api/client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('devuelve el JSON parseado cuando la respuesta es ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ hello: 'world' }),
    }));
    const data = await apiRequest<{ hello: string }>('/ping');
    expect(data).toEqual({ hello: 'world' });
  });

  it('lanza ApiError con el "detail" del backend cuando la respuesta falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 409, json: async () => ({ detail: 'Ese correo ya está registrado' }),
    }));
    await expect(apiRequest('/auth/register', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ message: 'Ese correo ya está registrado', status: 409 });
    await expect(apiRequest('/auth/register', { method: 'POST', body: {} }))
      .rejects.toBeInstanceOf(ApiError);
  });

  it('siempre incluye credentials:"include" para que viaje la cookie de sesión', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('/auth/me');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('devuelve undefined en respuestas 204 sin body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => { throw new Error('no body'); } }));
    const data = await apiRequest('/auth/logout', { method: 'POST' });
    expect(data).toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run __tests__/apiClient.test.ts`
Expected: FAIL — `Cannot find module '../lib/api/client'`.

- [ ] **Step 3: Implementar lib/api/client.ts**

Crear `lib/api/client.ts`:

```ts
// Cliente HTTP hacia el backend FastAPI (Fase 2). `credentials: 'include'`
// es obligatorio en cada llamada: es lo que hace que el navegador envíe la
// cookie httpOnly de sesión — el JS de esta app nunca la lee directamente,
// solo confía en que el navegador la reenvía automáticamente.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    body: isFormData ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string') detail = data.detail;
    } catch {
      // respuesta sin body JSON (ej. error de red o del propio servidor)
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
```

- [ ] **Step 4: Agregar el backend al CSP en next.config.mjs**

En `next.config.mjs`, agregar tras la línea `const __dirname = ...`:

```js
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
```

Y cambiar:

```js
              "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
```

por:

```js
              `connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com ${API_URL}`,
```

(Nota: el array de `value` deja de poder unirse solo con `.join('; ')` si esta línea dejó de ser un string literal simple — no es el caso: sigue siendo un string, solo que ahora usa interpolación de template literal en vez de comillas dobles. El resto del array no cambia.)

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `npx vitest run __tests__/apiClient.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/api/client.ts next.config.mjs __tests__/apiClient.test.ts
git commit -m "feat: cliente HTTP hacia el backend FastAPI y CSP actualizado"
```

---

### Task 12: `lib/api/auth.ts` y `lib/api/documents.ts`

**Files:**
- Create: `lib/api/auth.ts`
- Create: `lib/api/documents.ts`
- Test: `__tests__/apiAuth.test.ts`

**Interfaces:**
- Consumes: `apiRequest`, `ApiError` (Task 11); tipo `Sector` de `lib/types.ts`.
- Produces: `interface RegisterPayload`, `interface SessionInfo`, `registerCompany(payload): Promise<SessionInfo>`, `loginUser(email, password): Promise<SessionInfo>`, `fetchMe(): Promise<SessionInfo>`, `logoutUser(): Promise<void>` (en `lib/api/auth.ts`); `interface DocumentInfo`, `uploadDocument(file: File, reqId: string): Promise<DocumentInfo>`, `listDocuments(): Promise<DocumentInfo[]>` (en `lib/api/documents.ts`). Usadas por `hooks/useAppState.ts` (Task 13) y `components/UploadView.tsx` (Task 16).

- [ ] **Step 1: Escribir el test (falla, el módulo no existe)**

Crear `__tests__/apiAuth.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { loginUser, registerCompany } from '../lib/api/auth';

afterEach(() => {
  vi.unstubAllGlobals();
});

const DTO = {
  email: 'admin@empresa.cl',
  role: 'administrador',
  company_id: 'c1',
  company_nombre: 'Empresa Test',
  company_sector: 'tecnologia',
};

describe('lib/api/auth', () => {
  it('loginUser convierte snake_case del backend a camelCase', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => DTO }));
    const session = await loginUser('admin@empresa.cl', 'Clave-123!');
    expect(session).toEqual({
      email: 'admin@empresa.cl',
      role: 'administrador',
      companyId: 'c1',
      companyNombre: 'Empresa Test',
      companySector: 'tecnologia',
    });
  });

  it('registerCompany envía nombre_empresa en snake_case al backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => DTO });
    vi.stubGlobal('fetch', fetchMock);
    await registerCompany({
      rut: '11.111.111-1', nombreEmpresa: 'Empresa Test', email: 'admin@empresa.cl',
      password: 'Clave-123!', sector: 'tecnologia',
    });
    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody).toEqual({
      rut: '11.111.111-1', nombre_empresa: 'Empresa Test', email: 'admin@empresa.cl',
      password: 'Clave-123!', sector: 'tecnologia',
    });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run __tests__/apiAuth.test.ts`
Expected: FAIL — `Cannot find module '../lib/api/auth'`.

- [ ] **Step 3: Implementar lib/api/auth.ts**

Crear `lib/api/auth.ts`:

```ts
import { apiRequest } from './client';
import type { Sector, UserRole } from '@/lib/types';

export interface RegisterPayload {
  rut: string;
  nombreEmpresa: string;
  email: string;
  password: string;
  sector: Sector;
}

export interface SessionInfo {
  email: string;
  role: UserRole;
  companyId: string;
  companyNombre: string;
  companySector: Sector | null;
}

interface SessionResponseDto {
  email: string;
  role: UserRole;
  company_id: string;
  company_nombre: string;
  company_sector: string | null;
}

function fromDto(dto: SessionResponseDto): SessionInfo {
  return {
    email: dto.email,
    role: dto.role,
    companyId: dto.company_id,
    companyNombre: dto.company_nombre,
    companySector: (dto.company_sector as Sector | null) ?? null,
  };
}

export async function registerCompany(payload: RegisterPayload): Promise<SessionInfo> {
  const dto = await apiRequest<SessionResponseDto>('/auth/register', {
    method: 'POST',
    body: {
      rut: payload.rut,
      nombre_empresa: payload.nombreEmpresa,
      email: payload.email,
      password: payload.password,
      sector: payload.sector,
    },
  });
  return fromDto(dto);
}

export async function loginUser(email: string, password: string): Promise<SessionInfo> {
  const dto = await apiRequest<SessionResponseDto>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return fromDto(dto);
}

export async function fetchMe(): Promise<SessionInfo> {
  const dto = await apiRequest<SessionResponseDto>('/auth/me');
  return fromDto(dto);
}

export async function logoutUser(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' });
}
```

- [ ] **Step 4: Implementar lib/api/documents.ts**

Crear `lib/api/documents.ts`:

```ts
import { apiRequest } from './client';

export interface DocumentInfo {
  id: string;
  reqId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface DocumentDto {
  id: string;
  req_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
}

function fromDto(dto: DocumentDto): DocumentInfo {
  return {
    id: dto.id,
    reqId: dto.req_id,
    filename: dto.filename,
    contentType: dto.content_type,
    sizeBytes: dto.size_bytes,
    uploadedAt: dto.uploaded_at,
  };
}

export async function uploadDocument(file: File, reqId: string): Promise<DocumentInfo> {
  const formData = new FormData();
  formData.append('req_id', reqId);
  formData.append('file', file);
  const dto = await apiRequest<DocumentDto>('/documents/upload', { method: 'POST', body: formData });
  return fromDto(dto);
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const dtos = await apiRequest<DocumentDto[]>('/documents');
  return dtos.map(fromDto);
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `npx vitest run __tests__/apiAuth.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/api/auth.ts lib/api/documents.ts __tests__/apiAuth.test.ts
git commit -m "feat: funciones tipadas de auth y documentos hacia el backend"
```

---

### Task 13: `useAppState.ts` — login/registro async contra el backend

**Files:**
- Modify: `hooks/useAppState.ts`
- Delete: `lib/userRoles.ts`

**Interfaces:**
- Consumes: `loginUser`, `registerCompany` (Task 12, importado como `registerCompanyApi` para no chocar con el nombre del callback del hook), tipo `RegisterPayload`.
- Produces: `authSource: 'backend' | 'demo' | null` en el estado devuelto por el hook; `login(email: string, password: string): Promise<void>` (cambia de firma — antes era `login(rut, email, sector)`); `registerCompany(payload: RegisterPayload): Promise<void>` (nuevo). Ambas lanzan `ApiError` si el backend responde con error — el llamador (Task 15) decide cómo mostrarlo.

**Nota:** este hook no tiene tests automatizados hoy (no hay `@testing-library/react`/jsdom configurado en el proyecto — los tests existentes son de lógica pura). Se sigue el patrón ya establecido: se verifica con `npx tsc --noEmit` y con la prueba manual end-to-end de la Task 17.

- [ ] **Step 1: Eliminar lib/userRoles.ts**

El mapa hardcodeado de roles queda obsoleto: el rol ahora lo resuelve el backend en login/register, y el modo demo ya recibe el rol como parámetro directo (nunca pasó por `getRoleForUser`).

Run: `rm lib/userRoles.ts` (o eliminar el archivo con el explorador de archivos).

- [ ] **Step 2: Cambiar los imports del encabezado**

En `hooks/useAppState.ts`, cambiar:

```ts
'use client';
import { useState, useCallback } from 'react';
import type { Screen, ActiveTab, UploadedDoc, RequisitoResult, UserRole, AuditEvent, Sector, HistorialSnapshot } from '@/lib/types';
import { REQUISITOS, CHECKLIST_VERSION_LABEL } from '@/lib/requisitos';
import { analyzeDocument } from '@/lib/analyzer';
import { TOUR_STEP_COUNT } from '@/lib/tourConfig';
import { calcPct } from '@/lib/metrics';
import { buildCompanyId, type TenantContext } from '@/lib/tenant/context';
import { saveDocument, listDocuments } from '@/lib/tenant/repository';
import { getSecurityAuditLog, type SecurityEvent } from '@/lib/tenant/guard';
import { getRoleForUser } from '@/lib/userRoles';
```

a:

```ts
'use client';
import { useState, useCallback } from 'react';
import type { Screen, ActiveTab, UploadedDoc, RequisitoResult, UserRole, AuditEvent, Sector, HistorialSnapshot } from '@/lib/types';
import { REQUISITOS, CHECKLIST_VERSION_LABEL } from '@/lib/requisitos';
import { analyzeDocument } from '@/lib/analyzer';
import { TOUR_STEP_COUNT } from '@/lib/tourConfig';
import { calcPct } from '@/lib/metrics';
import { buildCompanyId, type TenantContext } from '@/lib/tenant/context';
import { saveDocument, listDocuments as listTenantDocuments } from '@/lib/tenant/repository';
import { getSecurityAuditLog, type SecurityEvent } from '@/lib/tenant/guard';
import { loginUser, registerCompany as registerCompanyApi, type RegisterPayload } from '@/lib/api/auth';

export type AuthSource = 'backend' | 'demo' | null;
```

**Nota:** `listDocuments` importado de `lib/tenant/repository` se renombra a `listTenantDocuments` en este archivo (no en `repository.ts`) para no chocar de nombre con `listDocuments` de `lib/api/documents.ts`, que se usará en la Task 16 desde otro archivo — aquí es solo para evitar confusión de lectura dentro de este mismo módulo. Buscar más abajo en el archivo el único uso existente (`const docsAislados = listDocuments(ctx);`) y renombrarlo también a `listTenantDocuments(ctx)`.

En la función `finishAnalysis`, cambiar:

```ts
    const docsAislados = listDocuments(ctx);
```

a:

```ts
    const docsAislados = listTenantDocuments(ctx);
```

- [ ] **Step 3: Agregar el estado authSource**

En `hooks/useAppState.ts`, cambiar:

```ts
  const [role, setRole] = useState<UserRole>('administrador');
```

a:

```ts
  const [role, setRole] = useState<UserRole>('administrador');
  // Distingue una sesión real (backend FastAPI) de una sesión de demostración
  // (100% local, sin backend) — usado por UploadView para decidir si además
  // de guardar localmente debe subir el archivo original al servidor.
  const [authSource, setAuthSource] = useState<AuthSource>(null);
```

- [ ] **Step 4: Reemplazar login por la versión async contra el backend**

En `hooks/useAppState.ts`, cambiar:

```ts
  const login = useCallback((rut: string, email: string, selectedSector: Sector = 'otro') => {
    // El rol NUNCA lo elige el usuario en la interfaz: se resuelve aquí,
    // después de "autenticar", a partir de su correo. En producción esta
    // línea sería reemplazada por una llamada al backend (p.ej. GET /me)
    // que devuelve el rol guardado en la base de datos para ese usuario.
    const resolvedRole = getRoleForUser(email);
    setCompanyName(rut);
    setCompanyId(buildCompanyId(rut));
    setRole(resolvedRole);
    setSector(selectedSector);
    setTourActive(true);
    setTourStep(0);
    setScreen('app');
    setActiveTab('subir');
  }, []);
```

a:

```ts
  // El rol y el nombre de la empresa NUNCA se eligen en el cliente: vienen
  // siempre de la respuesta del backend, que a su vez los toma del JWT de
  // sesión (nunca de un parámetro que el frontend pudiera manipular).
  const login = useCallback(async (email: string, password: string) => {
    const session = await loginUser(email, password);
    setCompanyName(session.companyNombre);
    setCompanyId(session.companyId);
    setRole(session.role);
    setSector(session.companySector ?? 'otro');
    setAuthSource('backend');
    setTourActive(true);
    setTourStep(0);
    setScreen('app');
    setActiveTab('subir');
  }, []);

  const registerCompany = useCallback(async (payload: RegisterPayload) => {
    const session = await registerCompanyApi(payload);
    setCompanyName(session.companyNombre);
    setCompanyId(session.companyId);
    setRole(session.role);
    setSector(session.companySector ?? payload.sector);
    setAuthSource('backend');
    setTourActive(true);
    setTourStep(0);
    setScreen('app');
    setActiveTab('subir');
  }, []);
```

- [ ] **Step 5: Marcar authSource en demo y limpiarlo en logout**

En `hooks/useAppState.ts`, dentro de `demo`, cambiar:

```ts
  const demo = useCallback((demoRole: UserRole) => {
    setCompanyName('Empresa Demo S.A.');
    setCompanyId(buildCompanyId(DEMO_RUT));
    setRole(demoRole);
    setSector('tecnologia');
```

a:

```ts
  const demo = useCallback((demoRole: UserRole) => {
    setCompanyName('Empresa Demo S.A.');
    setCompanyId(buildCompanyId(DEMO_RUT));
    setRole(demoRole);
    setSector('tecnologia');
    setAuthSource('demo');
```

En `logout`, cambiar:

```ts
  const logout = useCallback(() => {
    setCompanyName('');
    setCompanyId('');
    setSecurityEvents([]);
    setRole('administrador');
    setSector('otro');
```

a:

```ts
  const logout = useCallback(() => {
    setCompanyName('');
    setCompanyId('');
    setSecurityEvents([]);
    setRole('administrador');
    setSector('otro');
    setAuthSource(null);
```

- [ ] **Step 6: Exponer authSource y registerCompany en el objeto devuelto**

En `hooks/useAppState.ts`, cambiar:

```ts
  return {
    screen, activeTab, companyName, companyId, role, sector, uploadedDocs, results,
    previousResults, analyzed, auditLog, securityEvents, snapshots, tourActive, tourStep,
    login, demo, logout, uploadDoc, startAnalysis, finishAnalysis,
    switchTab, logDownload, logUploadRejected, advanceTour, skipTour,
  };
```

a:

```ts
  return {
    screen, activeTab, companyName, companyId, role, sector, authSource, uploadedDocs, results,
    previousResults, analyzed, auditLog, securityEvents, snapshots, tourActive, tourStep,
    login, registerCompany, demo, logout, uploadDoc, startAnalysis, finishAnalysis,
    switchTab, logDownload, logUploadRejected, advanceTour, skipTour,
  };
```

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: errores esperados en `components/Landing.tsx`, `components/LoginCard.tsx` y `app/page.tsx` (todavía llaman a `login` con la firma vieja) — se resuelven en las Tasks 14 y 15. Confirmar que **no** hay errores dentro de `hooks/useAppState.ts` ni referencias rotas a `lib/userRoles.ts`.

- [ ] **Step 8: Commit**

```bash
git add hooks/useAppState.ts
git rm lib/userRoles.ts
git commit -m "feat: login/registro async contra el backend en useAppState"
```

---

### Task 14: Toggle "Iniciar sesión / Crear empresa" en LoginCard

**Files:**
- Modify: `components/LoginCard.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `RegisterPayload`, `SessionInfo` (tipos de Task 12, usados indirectamente vía las props).
- Produces: nuevas `LoginCardProps`: `onLogin: (email: string, password: string) => Promise<void>`, `onRegister: (payload: RegisterPayload) => Promise<void>` (reemplazan a la `onLogin` vieja de firma `(rut, email, sector) => void`).

- [ ] **Step 1: Reescribir components/LoginCard.tsx**

Reemplazar el archivo completo `components/LoginCard.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { SECTORES_OPCIONES } from '@/lib/sectorData';
import type { UserRole, Sector } from '@/lib/types';
import type { RegisterPayload } from '@/lib/api/auth';

// Botones de "modo demostración": cada uno simula haber iniciado sesión ya
// autenticado con ese rol predefinido. Nunca es el usuario quien "elige"
// su rol de acceso real; esto es solo un atajo de prueba, separado del
// formulario de login/registro real (que sí habla con el backend).
const DEMO_ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'administrador', label: 'Administrador', desc: 'Acceso total' },
  { value: 'auditor',       label: 'Auditor',       desc: 'Ve registro de auditoría' },
  { value: 'visualizador',  label: 'Visualizador',  desc: 'Solo lectura' },
];

interface LoginCardProps {
  // El rol y el nombre de la empresa NUNCA viajan desde este formulario:
  // los resuelve el backend (ver lib/api/auth.ts) a partir del RUT/correo.
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (payload: RegisterPayload) => Promise<void>;
  onDemo: (role: UserRole) => void;
  onToast: (msg: string, type: 'yellow' | 'blue') => void;
}

// Formatea el RUT mientras el usuario escribe: 76.123.456-7
const formatRut = (raw: string): string => {
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
};

// Valida el RUT chileno con algoritmo módulo 11
const isValidRut = (value: string): boolean => {
  const clean = value.replace(/\./g, '').replace('-', '').trim();
  if (!/^\d{7,8}[0-9Kk]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dvInput = clean.slice(-1).toUpperCase();
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const dvExpected = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
  return dvInput === dvExpected;
};

// Validación de correo electrónico con formato real
const isValidEmail = (val: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

// Requisitos mínimos de seguridad para la contraseña
const getPassReqs = (pass: string) => ({
  length:  pass.length >= 8,
  upper:   /[A-Z]/.test(pass),
  lower:   /[a-z]/.test(pass),
  number:  /[0-9]/.test(pass),
  special: /[!@#$%&*]/.test(pass),
});

type LoginMode = 'login' | 'register';

export default function LoginCard({ onLogin, onRegister, onDemo }: LoginCardProps) {
  const [mode, setMode] = useState<LoginMode>('login');
  const [submitting, setSubmitting] = useState(false);

  const [rut,           setRut]           = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [email,  setEmail]  = useState('');
  const [pass,   setPass]   = useState('');
  const [sector, setSector] = useState<Sector>('otro');

  // Flags para mostrar errores solo después de que el usuario toca cada campo
  const [rutTouched,     setRutTouched]     = useState(false);
  const [nombreTouched,  setNombreTouched]  = useState(false);
  const [emailTouched,   setEmailTouched]   = useState(false);
  const [passTouched,    setPassTouched]    = useState(false);
  const [showPass,       setShowPass]       = useState(false);

  const passReqs = getPassReqs(pass);
  const passOk   = Object.values(passReqs).every(Boolean);

  const isFormValid = mode === 'login'
    ? isValidEmail(email) && pass.length > 0
    : isValidRut(rut) && nombreEmpresa.trim().length > 0 && isValidEmail(email) && passOk;

  const switchMode = (next: LoginMode) => {
    setMode(next);
    setRutTouched(false);
    setNombreTouched(false);
    setEmailTouched(false);
    setPassTouched(false);
  };

  const handleSubmit = async () => {
    setRutTouched(true);
    setNombreTouched(true);
    setEmailTouched(true);
    setPassTouched(true);
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    if (mode === 'login') {
      await onLogin(email.trim(), pass);
    } else {
      await onRegister({
        rut: rut.trim(), nombreEmpresa: nombreEmpresa.trim(), email: email.trim(), password: pass, sector,
      });
    }
    setSubmitting(false);
  };

  return (
    <div className="login-card">
      <h2>Acceder a la plataforma</h2>
      <p className="login-sub">Ingrese o cree su cuenta de empresa</p>

      <div className="login-mode-toggle" role="tablist" aria-label="Modo de acceso">
        <button
          type="button" role="tab" aria-selected={mode === 'login'}
          className={`login-mode-btn${mode === 'login' ? ' login-mode-btn--active' : ''}`}
          onClick={() => switchMode('login')}
        >
          Iniciar sesión
        </button>
        <button
          type="button" role="tab" aria-selected={mode === 'register'}
          className={`login-mode-btn${mode === 'register' ? ' login-mode-btn--active' : ''}`}
          onClick={() => switchMode('register')}
        >
          Crear empresa
        </button>
      </div>

      {mode === 'register' && (
        <>
          {/* RUT */}
          <div className="form-group">
            <label className="form-label">RUT de la empresa</label>
            <input
              className={`form-input${rutTouched && !isValidRut(rut) ? ' form-input--error' : ''}`}
              type="text" placeholder="76.123.456-7"
              value={rut} maxLength={12}
              onChange={e => setRut(formatRut(e.target.value))}
              onBlur={() => setRutTouched(true)}
            />
            {rutTouched && !isValidRut(rut) && (
              <p className="form-error-msg">Ingrese un RUT válido (ejemplo: 76.123.456-7)</p>
            )}
          </div>

          {/* Nombre de la empresa */}
          <div className="form-group">
            <label className="form-label">Nombre de la empresa</label>
            <input
              className={`form-input${nombreTouched && nombreEmpresa.trim().length === 0 ? ' form-input--error' : ''}`}
              type="text" placeholder="Mi Empresa S.A."
              value={nombreEmpresa}
              onChange={e => setNombreEmpresa(e.target.value)}
              onBlur={() => setNombreTouched(true)}
            />
            {nombreTouched && nombreEmpresa.trim().length === 0 && (
              <p className="form-error-msg">Ingrese el nombre de la empresa</p>
            )}
          </div>
        </>
      )}

      {/* Correo */}
      <div className="form-group">
        <label className="form-label">Correo corporativo</label>
        <input
          className={`form-input${emailTouched && !isValidEmail(email) ? ' form-input--error' : ''}`}
          type="email" placeholder="nombre@empresa.cl"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
        />
        {emailTouched && !isValidEmail(email) && (
          <p className="form-error-msg">Ingrese un correo electrónico válido (ejemplo: nombre@empresa.cl)</p>
        )}
      </div>

      {/* Contraseña */}
      <div className="form-group">
        <label className="form-label">Contraseña</label>
        <div className="pass-input-wrap">
          <input
            className={`form-input${passTouched && mode === 'register' && !passOk ? ' form-input--error' : ''}`}
            type={showPass ? 'text' : 'password'} placeholder="••••••••"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onBlur={() => setPassTouched(true)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <button
            type="button"
            className="pass-toggle"
            onClick={() => setShowPass(v => !v)}
            aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPass ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
        {mode === 'register' && (
          <ul className="pass-req-list">
            {([
              [passReqs.length,  'Mínimo 8 caracteres'],
              [passReqs.upper,   'Al menos una letra mayúscula'],
              [passReqs.lower,   'Al menos una letra minúscula'],
              [passReqs.number,  'Al menos un número'],
              [passReqs.special, 'Al menos un carácter especial (!@#$%&*)'],
            ] as [boolean, string][]).map(([ok, label]) => (
              <li key={label} className={`req-item${ok ? ' req-item--ok' : ' req-item--fail'}`}>
                <span className="req-icon">{ok ? '✓' : '·'}</span>
                {label}
              </li>
            ))}
          </ul>
        )}
        {passTouched && mode === 'register' && !passOk && (
          <p className="form-error-msg">La contraseña no cumple los requisitos mínimos de seguridad</p>
        )}
      </div>

      {/* Sector — solo al crear empresa */}
      {mode === 'register' && (
        <div className="form-group">
          <label className="form-label">Sector de su empresa</label>
          <select className="form-input form-select" value={sector}
            onChange={e => setSector(e.target.value as Sector)}>
            {SECTORES_OPCIONES.map(s => (
              <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>
            ))}
          </select>
        </div>
      )}

      <button
        className="btn-login"
        onClick={handleSubmit}
        disabled={!isFormValid || submitting}
        aria-disabled={!isFormValid || submitting}
      >
        {submitting ? 'Un momento…' : mode === 'login' ? 'Ingresar →' : 'Crear empresa →'}
      </button>

      <div className="login-divider">o continúe sin registrarse</div>

      {/*
        Modo demostración: claramente separado del login/registro real (no
        habla con el backend). Cada botón simula una sesión YA autenticada
        con un rol predefinido y datos de ejemplo — el usuario nunca elige
        su rol aquí tampoco, solo elige cuál demo quiere ver.
      */}
      <div className="demo-mode-box">
        <div className="demo-mode-label">
          <span aria-hidden="true">🧪</span> Modo demostración (no es un ingreso real)
        </div>
        <p className="demo-mode-desc">
          Pruebe la plataforma con datos de ejemplo ya cargados, viendo cómo cambia la
          experiencia según el rol del usuario.
        </p>
        <div className="demo-mode-buttons">
          {DEMO_ROLES.map(r => (
            <button
              key={r.value}
              className="btn-demo"
              title={r.desc}
              onClick={() => onDemo(r.value)}
            >
              Entrar como {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="login-security">
        <div className="login-security-item">
          <span>🔒</span>
          <span>Sesión cifrada (cookie httpOnly)</span>
        </div>
        <div className="login-security-item">
          <span>🛡</span>
          <span>Aislamiento por empresa</span>
        </div>
        <div className="login-security-item">
          <span>🔑</span>
          <span>AES-256</span>
        </div>
      </div>
    </div>
  );
}
```

(Nota sobre `login-security`: el texto "Procesamiento local" / "Sin servidores externos" de la versión anterior ya no describe con precisión el flujo de login/registro, que ahora sí habla con un backend real — se reemplaza por una descripción exacta de la protección real de esta fase, sin tocar el resto de la copy de `Landing.tsx`, que queda fuera del alcance de este plan.)

- [ ] **Step 2: Agregar los estilos del toggle**

En `app/globals.css`, al final del archivo, agregar:

```css
/* ── Toggle "Iniciar sesión / Crear empresa" (Fase 2: backend real) ── */
.login-mode-toggle {
  display: flex; background: var(--surface2); border: 1px solid var(--border);
  border-radius: 99px; padding: 3px; margin-bottom: 20px; gap: 3px;
}
.login-mode-btn {
  flex: 1; padding: 7px 0; border: none; background: transparent; border-radius: 99px;
  font-size: 12.5px; font-weight: 600; color: var(--text3); cursor: pointer;
  font-family: var(--font-sora),'Sora',sans-serif; transition: all 0.18s;
}
.login-mode-btn:hover { color: var(--text2); }
.login-mode-btn--active {
  background: var(--white); color: var(--navy); box-shadow: 0 1px 4px rgba(15,30,61,0.12);
}
```

- [ ] **Step 3: Verificar tipos (fallará hasta la Task 15, es esperado)**

Run: `npx tsc --noEmit`
Expected: errores restantes solo en `components/Landing.tsx` y `app/page.tsx` (props `onLogin`/`onRegister` todavía no coinciden ahí) — se resuelven en la Task 15. Confirmar que no hay errores dentro de `components/LoginCard.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/LoginCard.tsx app/globals.css
git commit -m "feat: toggle iniciar sesion / crear empresa en LoginCard"
```

---

### Task 15: Wiring en `Landing.tsx` y `app/page.tsx`

**Files:**
- Modify: `components/Landing.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `login`, `registerCompany`, `authSource` (Task 13); `RegisterPayload` (Task 12); `ApiError` (Task 11); `LoginCardProps` nuevas (Task 14).

- [ ] **Step 1: Actualizar LandingProps y el wiring a LoginCard**

En `components/Landing.tsx`, cambiar:

```tsx
'use client';
import LoginCard from './LoginCard';
import { ScaleIcon, FileTextIcon, SearchCheckIcon, AlertCircleIcon, BarChart2Icon } from './Icons';
import type { UserRole, Sector } from '@/lib/types';

interface LandingProps {
  onLogin: (rut: string, email: string, sector: Sector) => void;
  onDemo: (role: UserRole) => void;
  onToast: (msg: string, type: 'yellow' | 'blue') => void;
}
```

a:

```tsx
'use client';
import LoginCard from './LoginCard';
import { ScaleIcon, FileTextIcon, SearchCheckIcon, AlertCircleIcon, BarChart2Icon } from './Icons';
import type { UserRole } from '@/lib/types';
import type { RegisterPayload } from '@/lib/api/auth';

interface LandingProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (payload: RegisterPayload) => Promise<void>;
  onDemo: (role: UserRole) => void;
  onToast: (msg: string, type: 'yellow' | 'blue') => void;
}
```

Y más abajo, cambiar:

```tsx
export default function Landing({ onLogin, onDemo, onToast }: LandingProps) {
```

a:

```tsx
export default function Landing({ onLogin, onRegister, onDemo, onToast }: LandingProps) {
```

Y:

```tsx
        <LoginCard onLogin={onLogin} onDemo={onDemo} onToast={onToast} />
```

a:

```tsx
        <LoginCard onLogin={onLogin} onRegister={onRegister} onDemo={onDemo} onToast={onToast} />
```

- [ ] **Step 2: Actualizar app/page.tsx**

En `app/page.tsx`, cambiar el import del encabezado de:

```tsx
'use client';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/useToast';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import Landing from '@/components/Landing';
import AppShell from '@/components/AppShell';
import AnalyzingScreen from '@/components/AnalyzingScreen';
import Toast from '@/components/Toast';
```

a:

```tsx
'use client';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/useToast';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { ApiError } from '@/lib/api/client';
import Landing from '@/components/Landing';
import AppShell from '@/components/AppShell';
import AnalyzingScreen from '@/components/AnalyzingScreen';
import Toast from '@/components/Toast';
```

Y cambiar:

```tsx
      {state.screen === 'landing' && (
        <Landing
          onLogin={(rut, email, sector) => {
            state.login(rut, email, sector);
            toast('✓ Bienvenido. Suba sus documentos para comenzar el diagnóstico.', 'blue');
          }}
          onDemo={role => {
            state.demo(role);
            toast('✓ Modo demostración activado con 3 documentos de ejemplo.', 'blue');
          }}
          onToast={toast}
        />
      )}
```

a:

```tsx
      {state.screen === 'landing' && (
        <Landing
          onLogin={async (email, password) => {
            try {
              await state.login(email, password);
              toast('✓ Bienvenido. Suba sus documentos para comenzar el diagnóstico.', 'blue');
            } catch (err) {
              toast(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión', 'yellow');
            }
          }}
          onRegister={async payload => {
            try {
              await state.registerCompany(payload);
              toast('✓ Empresa registrada. Suba sus documentos para comenzar el diagnóstico.', 'blue');
            } catch (err) {
              toast(err instanceof ApiError ? err.message : 'No se pudo registrar la empresa', 'yellow');
            }
          }}
          onDemo={role => {
            state.demo(role);
            toast('✓ Modo demostración activado con 3 documentos de ejemplo.', 'blue');
          }}
          onToast={toast}
        />
      )}
```

Por último, en el bloque `{state.screen === 'app' && (<AppShell ... />)}`, agregar la prop `authSource` (se consume en la Task 16). Cambiar:

```tsx
        <AppShell
          companyName={state.companyName}
          companyId={state.companyId}
          securityEvents={state.securityEvents}
          role={state.role}
          sector={state.sector}
```

a:

```tsx
        <AppShell
          companyName={state.companyName}
          companyId={state.companyId}
          securityEvents={state.securityEvents}
          role={state.role}
          sector={state.sector}
          authSource={state.authSource}
```

- [ ] **Step 3: Verificar tipos (fallará hasta la Task 16 por AppShellProps, es esperado)**

Run: `npx tsc --noEmit`
Expected: el único error restante debe ser en `components/AppShell.tsx` (`authSource` no está en `AppShellProps` todavía) — se resuelve en la Task 16. Confirmar que `components/Landing.tsx` y `app/page.tsx` ya no tienen errores.

- [ ] **Step 4: Commit**

```bash
git add components/Landing.tsx app/page.tsx
git commit -m "feat: conectar login/registro real del backend en Landing y page.tsx"
```

---

### Task 16: Subida en segundo plano al backend desde UploadView

**Files:**
- Modify: `components/AppShell.tsx`
- Modify: `components/UploadView.tsx`

**Interfaces:**
- Consumes: `uploadDocument` (Task 12), `authSource` (Task 13, ya pasado por `app/page.tsx` en la Task 15).

- [ ] **Step 1: Agregar authSource a AppShellProps y pasarlo a UploadView**

En `components/AppShell.tsx`, cambiar:

```tsx
import type { ActiveTab, AuditEvent, UploadedDoc, RequisitoResult, UserRole, Sector, HistorialSnapshot } from '@/lib/types';
```

a:

```tsx
import type { ActiveTab, AuditEvent, UploadedDoc, RequisitoResult, UserRole, Sector, HistorialSnapshot } from '@/lib/types';
import type { AuthSource } from '@/hooks/useAppState';
```

Cambiar:

```tsx
interface AppShellProps {
  companyName: string;
  companyId: string;
  securityEvents: SecurityEvent[];
  role: UserRole;
  sector: Sector;
```

a:

```tsx
interface AppShellProps {
  companyName: string;
  companyId: string;
  securityEvents: SecurityEvent[];
  role: UserRole;
  sector: Sector;
  authSource: AuthSource;
```

Cambiar:

```tsx
export default function AppShell({
  companyName, companyId, securityEvents, role, sector, auditLog, activeTab, uploadedDocs, results,
```

a:

```tsx
export default function AppShell({
  companyName, companyId, securityEvents, role, sector, authSource, auditLog, activeTab, uploadedDocs, results,
```

Localizar las **dos** apariciones de `<UploadView` (una en el paso del tour, otra en la pestaña "Subir") y agregar la prop `authSource={authSource}` junto a `onUpload={onUpload}` en ambas:

```tsx
            onUpload={onUpload}
            onUploadRejected={onUploadRejected}
```

→

```tsx
            onUpload={onUpload}
            onUploadRejected={onUploadRejected}
            authSource={authSource}
```

(Aplicar el mismo cambio en los dos bloques `<UploadView ... />` del archivo.)

- [ ] **Step 2: Disparar la subida al backend desde UploadView**

En `components/UploadView.tsx`, cambiar:

```tsx
'use client';
import { useRef, useState } from 'react';
import { REQUISITOS } from '@/lib/requisitos';
import { extractDocumentText } from '@/lib/extractText';
import type { UploadedDoc, UserRole } from '@/lib/types';

interface UploadViewProps {
  uploadedDocs: Record<string, UploadedDoc>;
  role: UserRole;
  onUpload: (reqId: string, doc: UploadedDoc) => void;
  onUploadRejected: (reqId: string, fileName: string, reason: string) => void;
  onStartAnalysis: () => void;
  onToast: (msg: string, type: 'green' | 'yellow' | 'blue') => void;
}

export default function UploadView({ uploadedDocs, role, onUpload, onUploadRejected, onStartAnalysis, onToast }: UploadViewProps) {
```

a:

```tsx
'use client';
import { useRef, useState } from 'react';
import { REQUISITOS } from '@/lib/requisitos';
import { extractDocumentText } from '@/lib/extractText';
import { uploadDocument } from '@/lib/api/documents';
import type { AuthSource } from '@/hooks/useAppState';
import type { UploadedDoc, UserRole } from '@/lib/types';

interface UploadViewProps {
  uploadedDocs: Record<string, UploadedDoc>;
  role: UserRole;
  authSource: AuthSource;
  onUpload: (reqId: string, doc: UploadedDoc) => void;
  onUploadRejected: (reqId: string, fileName: string, reason: string) => void;
  onStartAnalysis: () => void;
  onToast: (msg: string, type: 'green' | 'yellow' | 'blue') => void;
}

export default function UploadView({ uploadedDocs, role, authSource, onUpload, onUploadRejected, onStartAnalysis, onToast }: UploadViewProps) {
```

Y dentro de `handleFileSelected`, cambiar:

```tsx
    onUpload(reqId, result);
    const req = REQUISITOS.find(r => r.id === reqId);
    if (req) {
      const words = result.wordCount ?? 0;
      const info = result.extractedFully
        ? `${words.toLocaleString('es-CL')} palabras extraídas`
        : 'solo nombre de archivo';
      onToast(`✓ "${file.name}" cargado · ${info}`, 'green');
    }
    pendingReqId.current = null;
  };
```

a:

```tsx
    onUpload(reqId, result);
    const req = REQUISITOS.find(r => r.id === reqId);
    if (req) {
      const words = result.wordCount ?? 0;
      const info = result.extractedFully
        ? `${words.toLocaleString('es-CL')} palabras extraídas`
        : 'solo nombre de archivo';
      onToast(`✓ "${file.name}" cargado · ${info}`, 'green');
    }
    pendingReqId.current = null;

    // Además de guardarse localmente (arriba), el archivo original se sube
    // al backend en segundo plano — solo si hay una sesión real (no en modo
    // demostración). El análisis del motor sigue siendo 100% local y no
    // depende de que esta llamada tenga éxito: si el backend no responde,
    // no interrumpe ni revierte nada de lo que ya pasó en el cliente.
    if (authSource === 'backend') {
      uploadDocument(file, reqId).catch(() => {
        onToast(`El documento se analizó localmente, pero no se pudo respaldar en el servidor`, 'yellow');
      });
    }
  };
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores en todo el proyecto.

- [ ] **Step 4: Correr toda la suite de Vitest**

Run: `npm test`
Expected: PASS en todos los archivos de `__tests__/` (incluyendo los nuevos `apiClient.test.ts` y `apiAuth.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add components/AppShell.tsx components/UploadView.tsx
git commit -m "feat: subir el documento original al backend en segundo plano tras el analisis local"
```

---

### Task 17: README raíz, build de producción y verificación manual end-to-end

**Files:**
- Create: `README.md` (raíz del proyecto)

**Interfaces:** ninguna — verificación final.

- [ ] **Step 1: Crear README.md en la raíz**

Crear `README.md`:

```markdown
# DataShield — Ley 21.719

Plataforma de diagnóstico de cumplimiento de la Ley 21.719 (protección de
datos personales, Chile). El análisis de documentos (motor de reglas +
capa semántica) corre 100% en el navegador. Desde la Fase 2, el registro
de empresas, el login y la recepción de documentos los maneja un backend
real (FastAPI), ver `backend/README.md`.

## Levantar todo en desarrollo

Se necesitan dos procesos corriendo a la vez, en dos terminales distintas.

**Terminal 1 — backend (puerto 8000):**

```bash
cd backend
python -m venv venv
venv\Scripts\Activate.ps1   # PowerShell; en bash: source venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend (puerto 3000):**

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`. El frontend habla con el backend en
`http://localhost:8000` (configurable con `NEXT_PUBLIC_API_URL`).

## Tests

```bash
npm test                        # frontend (Vitest)
cd backend && python -m pytest  # backend (pytest)
```
```

- [ ] **Step 2: Build de producción del frontend**

Run: `npm run build`
Expected: build exitoso, sin errores de tipos.

- [ ] **Step 3: Verificación manual end-to-end**

Run (Terminal 1): `cd backend && uvicorn main:app --reload --port 8000`
Run (Terminal 2): `npm run dev`

En el navegador (`http://localhost:3000`):
1. En la tarjeta de login, ir a "Crear empresa". Completar RUT (ej.
   `11.111.111-1`), nombre de empresa, correo, contraseña que cumpla los 5
   requisitos, y sector. Enviar.
2. Verificar que entra directo a la pantalla de subir documentos (sin pasos
   extra) y que el toast dice "Empresa registrada...".
3. Intentar registrar el mismo RUT de nuevo (otra pestaña o después de
   cerrar sesión) → debe rechazarse con el mensaje "Esta empresa ya está
   registrada...".
4. Cerrar sesión, volver a "Iniciar sesión" con el correo/contraseña ya
   creados → debe entrar correctamente.
5. Subir un documento real (PDF/DOCX) para cualquiera de los 3 requisitos.
   Verificar en la pestaña Network del navegador que hubo un `POST
   http://localhost:8000/documents/upload` con `status 201`, y que el
   diagnóstico local (extracción + análisis) siguió funcionando igual que
   antes.
6. Ejecutar: `curl http://localhost:8000/documents -b "access_token=<valor
   de la cookie tomado del navegador>"` (o revisar en las DevTools →
   Application → Cookies que `access_token` es `HttpOnly`) y confirmar que
   el documento subido aparece listado.
7. Repetir el registro con un RUT distinto (ej. `22.222.222-2`) en una
   ventana de incógnito, subir un documento, y confirmar que `GET
   /documents` de esa sesión NO incluye el documento de la primera empresa.

- [ ] **Step 4: Commit final**

```bash
git add README.md
git commit -m "docs: instrucciones para levantar backend y frontend juntos"
```

---

## Resumen para el usuario al terminar la Task 17

Al completar este plan, reportar:
1. Los dos comandos para levantar backend y frontend (Terminal 1 / Terminal 2 de la Task 17, Step 1).
2. El resultado real de la verificación manual (Task 17, Step 3) — qué pasos se probaron y qué se observó.
3. La tabla de endpoints (ya está en `backend/README.md`, Task 10) y cómo probarlos con `curl` o `/docs`.
4. Recordar hacer commit de cualquier ajuste manual que haya surgido durante la verificación, si no quedó ya cubierto por el Step 4.
