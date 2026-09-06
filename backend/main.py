from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

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


def _migrar_columnas_nuevas() -> None:
    # El proyecto todavía no usa Alembic: create_all() crea tablas que faltan,
    # pero no agrega columnas nuevas a tablas que ya existían antes del cambio
    # de modelo. Este parche mínimo evita que una base SQLite de desarrollo
    # creada antes de agregar `onboarding_completed` quede rota.
    inspector = inspect(engine)
    if 'users' not in inspector.get_table_names():
        return
    columnas_users = {c['name'] for c in inspector.get_columns('users')}
    if 'onboarding_completed' not in columnas_users:
        with engine.begin() as conn:
            conn.execute(text(
                'ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT 0'
            ))
    # Fase 5 — columnas del segundo factor TOTP.
    nuevas_mfa = {
        'mfa_enabled': 'ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT 0',
        'mfa_secret_enc': 'ALTER TABLE users ADD COLUMN mfa_secret_enc VARCHAR',
        'mfa_backup_codes': 'ALTER TABLE users ADD COLUMN mfa_backup_codes VARCHAR',
    }
    faltantes = [sql for col, sql in nuevas_mfa.items() if col not in columnas_users]
    if faltantes:
        with engine.begin() as conn:
            for sql in faltantes:
                conn.execute(text(sql))


@app.on_event('startup')
def on_startup():
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _migrar_columnas_nuevas()


@app.get('/health')
def health():
    return {'status': 'ok'}
