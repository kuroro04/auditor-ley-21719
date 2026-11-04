from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from core.config import APP_ENV, COOKIE_NAME, COOKIE_SECURE, FRONTEND_ORIGIN, STORAGE_DIR, TESTING
from core.limiter import limiter
from db.database import Base, engine
from db import models  # noqa: F401 — registra los modelos en Base antes de create_all
from routers import auth, client_events, documents
from services import audit_externo

# Solo exponer la documentación interactiva en desarrollo: en producción
# /docs, /redoc y /openapi.json quedan inaccesibles (None deshabilita la ruta).
_dev = APP_ENV == 'development'
app = FastAPI(
    title="DataShield API",
    version="0.1.0",
    docs_url='/docs' if _dev else None,
    redoc_url='/redoc' if _dev else None,
    openapi_url='/openapi.json' if _dev else None,
)

# ── Rate limiting ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    # Obligatorio para que la cookie httpOnly de sesión viaje en las
    # peticiones fetch(..., { credentials: 'include' }) del frontend.
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'DELETE', 'OPTIONS', 'PATCH', 'PUT'],
    allow_headers=['Content-Type', 'Cookie', 'Authorization', 'X-Requested-With', 'Accept'],
)


# ── Cabeceras de Seguridad HTTP ───────────────────────────────────────────────
@app.middleware('http')
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(), payment=()'
    if COOKIE_SECURE:
        response.headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload'
    return response


# ── Protección CSRF ────────────────────────────────────────────────────────────
# Para requests autenticados por cookie que modifican estado, verifica que el
# origen de la petición coincide con el frontend esperado.
# - SameSite=lax ya bloquea la mayoría de los ataques CSRF en navegadores modernos.
# - Esta capa adicional rechaza explícitamente requests con Origin/Referer ajenos.
# - En tests (TESTING=1) se omite: el TestClient no envía Origin y no necesita
#   protección CSRF (las sesiones son efímeras y no hay cookies persistentes).
@app.middleware('http')
async def csrf_protection(request: Request, call_next):
    if not TESTING and request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
        if request.cookies.get(COOKIE_NAME):
            expected = FRONTEND_ORIGIN.rstrip('/')
            origin = request.headers.get('origin')
            if origin is not None:
                # Origin está presente: comparación exacta (sin path).
                ok = origin.rstrip('/') == expected
            else:
                # Sin Origin, intentar con Referer: parsear y comparar solo el
                # scheme+host+port para evitar el bypass "expected.evil.com".
                ref = request.headers.get('referer', '')
                parsed = urlparse(ref)
                ref_origin = (
                    f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.hostname else ''
                )
                ok = ref_origin.rstrip('/') == expected
            if not ok:
                return JSONResponse(
                    status_code=403,
                    content={'detail': 'CSRF: el origen de la petición no está permitido'},
                )
    return await call_next(request)


app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(client_events.router)


def _migrar_columnas_nuevas() -> None:
    # El proyecto todavía no usa Alembic: create_all() crea tablas que faltan,
    # pero no agrega columnas nuevas a tablas que ya existían antes del cambio
    # de modelo. Este parche mínimo evita que una base SQLite de desarrollo
    # creada antes de agregar nuevas columnas quede rota.
    try:
        inspector = inspect(engine)
        if 'users' not in inspector.get_table_names():
            return
        columnas_users = {c['name'] for c in inspector.get_columns('users')}
        nuevas = {
            'onboarding_completed': 'ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false',
            'mfa_enabled': 'ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT false',
            'mfa_secret_enc': 'ALTER TABLE users ADD COLUMN mfa_secret_enc VARCHAR',
            'mfa_backup_codes': 'ALTER TABLE users ADD COLUMN mfa_backup_codes VARCHAR',
            'last_totp_step': 'ALTER TABLE users ADD COLUMN last_totp_step INTEGER',
            'token_version': 'ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1',
        }
        faltantes = [sql for col, sql in nuevas.items() if col not in columnas_users]
        if faltantes:
            with engine.begin() as conn:
                for sql in faltantes:
                    conn.execute(text(sql))
    except Exception:
        # En PostgreSQL donde el usuario de la app no sea owner de la tabla o en esquemas ya gestionados
        pass


@app.on_event('startup')
def on_startup():
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _migrar_columnas_nuevas()


@app.on_event('shutdown')
def on_shutdown():
    # Intenta vaciar la cola de copias a Better Stack antes de salir (con
    # tope de tiempo: un Better Stack caído no debe colgar el apagado).
    audit_externo.detener()


@app.get('/health')
def health():
    return {'status': 'ok'}
