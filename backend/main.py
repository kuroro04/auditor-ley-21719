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
