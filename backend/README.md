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
