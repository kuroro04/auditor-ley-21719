# Backend real con FastAPI (Fase 2) — DataShield Ley 21.719

## Contexto

Hasta ahora DataShield corre 100% en el navegador: el login es una simulación
(`lib/userRoles.ts` resuelve el rol desde un mapa hardcodeado, sin verificar
contraseña) y los documentos se guardan en un `Map` en memoria
(`lib/tenant/repository.ts`) que representa "cómo se comportaría un backend
real" sin serlo. Esta fase agrega el primer servidor real: un backend FastAPI
que maneja registro de empresas, autenticación y recepción de documentos, y
lo conecta con el frontend Next.js existente. El análisis del motor de reglas
(`lib/analyzer.ts`) y la capa semántica siguen corriendo en el cliente, sin
cambios — esta fase no los toca.

Almacenamiento: SQLite vía SQLAlchemy (no en memoria), con los modelos
diseñados para que migrar a PostgreSQL en la Fase 3 sea solo cambiar la
`DATABASE_URL`, sin tocar lógica. La cuarentena/antivirus de documentos queda
para la Fase 4.

## Objetivo

1. Una empresa puede registrarse (`POST /auth/register`) con RUT, nombre,
   correo y contraseña. El primer usuario de esa empresa es su administrador.
2. Un usuario puede autenticarse (`POST /auth/login`); el backend verifica
   la contraseña y emite una sesión — el rol **nunca** lo envía el cliente.
3. El `company_id` de cada request sale siempre del token de sesión, nunca de
   un parámetro que el cliente controle.
4. Un usuario autenticado puede subir un documento (`POST /documents/upload`),
   validado por tipo y contenido (magic bytes), asociado a su empresa.
5. Un usuario autenticado puede listar los documentos de su propia empresa
   (`GET /documents`), nunca los de otra.
6. El frontend usa este backend para registro/login/subida en vez de las
   simulaciones actuales, sin romper el análisis local existente.

## Arquitectura

### Estructura de carpetas — `backend/`

```
backend/
  main.py                    # app FastAPI, CORS, montaje de routers
  core/
    config.py                # lee .env: SECRET_KEY, DATABASE_URL, FRONTEND_ORIGIN
    security.py               # hash de password (passlib/bcrypt), crear/verificar JWT
  db/
    database.py                # engine + SessionLocal (SQLAlchemy)
    models.py                   # ORM: Company, User, Document
  models/
    schemas.py                   # Pydantic: RegisterRequest, LoginRequest, UserOut, DocumentOut...
  routers/
    auth.py                       # /auth/register /auth/login /auth/me /auth/logout
    documents.py                   # /documents/upload /documents
  services/
    rut_service.py                  # validación RUT chileno (módulo 11)
    file_security_service.py         # magic bytes + extensión (espejo de lib/fileSecurity.ts)
  storage/                            # archivos subidos, por company_id (gitignored)
  __tests__ / tests/                   # pytest
  requirements.txt
  .env.example
  .gitignore
```

`db/` (modelos SQLAlchemy) se separa de `models/` (schemas Pydantic de
request/response) para no mezclar la capa de persistencia con los contratos
de la API.

### Datos (SQLite vía SQLAlchemy)

- **Company**: `id` (uuid), `rut` (unique), `nombre`, `sector` (nullable),
  `created_at`.
- **User**: `id` (uuid), `company_id` (FK), `email` (unique global),
  `password_hash`, `role` (`administrador` / `auditor` / `visualizador`),
  `created_at`.
- **Document**: `id` (uuid), `company_id` (FK), `req_id` (id del requisito de
  `lib/requisitos.ts`, ej. `politica_privacidad`), `filename`, `stored_path`,
  `content_type`, `size_bytes`, `uploaded_by` (FK User), `uploaded_at`.

`DATABASE_URL` vive en `.env` (default `sqlite:///./backend.db`), nunca
hardcodeada — así la Fase 3 solo cambia esa variable por una URL de Postgres.

### Autenticación

- Password: `passlib[bcrypt]`. Nunca se guarda ni se loguea en texto plano.
- Sesión: JWT (`python-jose`, HS256, `SECRET_KEY` desde `.env`). Payload:
  `sub` (user id), `company_id`, `role`, `exp`.
- El JWT viaja en una **cookie httpOnly** (`Set-Cookie: access_token=...;
  HttpOnly; SameSite=Lax; Secure=<True en prod>`), nunca en el body de
  respuesta ni en `localStorage`/`sessionStorage`. Comentario explícito en
  `core/security.py` explicando por qué: una cookie httpOnly es invisible
  para JavaScript, así que un XSS en el frontend no puede robar el token
  (a diferencia de guardarlo en `localStorage`/`sessionStorage`, que sí es
  legible por cualquier script que corra en la página).
- CSRF: **fuera de alcance de esta fase**, documentado como pendiente en el
  README y en un comentario junto a la configuración de CORS — con
  `SameSite=Lax` el riesgo de CSRF clásico ya se reduce bastante, pero una
  defensa completa (token CSRF de doble-submit o header custom) queda para
  una fase posterior.
- `get_current_user` (dependency): decodifica la cookie; `company_id` y
  `role` de cada request salen **siempre** del payload del JWT, nunca de un
  parámetro de la URL o del body.
- CORS: `allow_origins=[FRONTEND_ORIGIN]` (default `http://localhost:3000`),
  `allow_credentials=True` (obligatorio para que la cookie viaje en el
  `fetch` del frontend).

### Endpoints

- **`POST /auth/register`** — body `{rut, nombre_empresa, email, password,
  sector?}`.
  - Valida RUT con algoritmo módulo 11 (espejo de `isValidRut` en
    `LoginCard.tsx`) y requisitos de contraseña (mismos que ya se muestran en
    el formulario: 8+ caracteres, mayúscula, minúscula, número, especial).
  - **Si el RUT ya existe → `409 Conflict`** con mensaje: *"Esta empresa ya
    está registrada. Si perteneces a ella, solicita a tu administrador que te
    dé acceso."* No se permite que un registro nuevo se una a una empresa
    existente — el RUT es información pública en Chile, así que auto-unirse
    solo con el RUT sería un hueco de seguridad. Incorporar nuevos usuarios a
    una empresa ya registrada es responsabilidad del administrador
    (flujo de "invitar usuarios" queda para una fase futura, no se construye
    ahora).
  - Si el email ya existe (en cualquier empresa) → `409 Conflict`.
  - Si todo es válido: crea `Company` + `User` con `role='administrador'`,
    emite la cookie de sesión igual que login.
- **`POST /auth/login`** — body `{email, password}`. Verifica hash; si es
  correcto, emite la cookie y responde `{email, role, company_id,
  company_nombre}` (evita un round-trip extra a `/me` inmediatamente después
  de loguear). Credenciales inválidas → `401`, mensaje genérico (no revela si
  falló el email o la contraseña).
- **`GET /auth/me`** — mismos datos que el login, a partir de la cookie.
  `401` si no hay cookie válida.
- **`POST /auth/logout`** — limpia la cookie (`Max-Age=0`). Necesario porque
  una cookie httpOnly no puede borrarse desde JavaScript; solo el servidor
  puede instruir al navegador a eliminarla.
- **`POST /documents/upload`** — multipart (`file`, `req_id`), requiere
  sesión. Reutiliza las mismas reglas que `lib/fileSecurity.ts`: extensiones
  permitidas (`txt,pdf,doc,docx,xls,xlsx`), extensiones peligrosas
  bloqueadas, doble extensión sospechosa, límite de 50MB, y verificación de
  *magic bytes* (firma binaria real vs. extensión declarada) portada a
  Python en `file_security_service.py`. Si se rechaza → `400` con el motivo.
  Si se acepta: se guarda en `backend/storage/<company_id>/<uuid>_<nombre
  saneado>` y se inserta el registro `Document` con `company_id` y
  `uploaded_by` tomados del token, nunca del body.
- **`GET /documents`** — lista los `Document` de la empresa del token
  (nunca acepta un `company_id` como parámetro).

### Frontend

- `lib/api/client.ts` — wrapper de `fetch` con `credentials: 'include'`
  siempre (para que la cookie viaje) y manejo tipado de errores
  (`{detail}` de FastAPI → excepción con mensaje legible).
- `lib/api/auth.ts` — `registerCompany()`, `loginUser()`, `fetchMe()`,
  `logoutUser()`.
- `lib/api/documents.ts` — `uploadDocument(file, reqId)`, `listDocuments()`.
- `next.config.mjs` — se agrega `http://localhost:8000` (vía
  `NEXT_PUBLIC_API_URL`) a `connect-src` del CSP; sin esto el navegador
  bloquea el `fetch` al backend aunque el backend responda bien.
- `components/LoginCard.tsx` — toggle "Iniciar sesión / Crear empresa" en la
  misma tarjeta (mismo estilo visual, sin rediseño):
  - **Crear empresa**: RUT, nombre de empresa, correo, contraseña, sector →
    `registerCompany()`. Mantiene las validaciones ya existentes (RUT,
    email, contraseña robusta). Si el backend responde 409 por RUT
    duplicado, se muestra el mensaje del backend tal cual.
  - **Iniciar sesión**: solo correo y contraseña → `loginUser()`.
  - El bloque de "modo demostración" no cambia — sigue siendo una simulación
    100% local, independiente del backend.
- `hooks/useAppState.ts` — `login`/`registerCompany` pasan a ser funciones
  async que llaman al backend y setean `companyName`/`companyId`/`role` con
  la respuesta del servidor. Se agrega `authSource: 'backend' | 'demo' |
  null` para distinguir una sesión real de una demo. Se elimina
  `lib/userRoles.ts` (el mapa hardcodeado de roles queda obsoleto: el modo
  demo ya recibe el rol como parámetro directo, y el login real ahora lo
  resuelve el servidor).
- `components/UploadView.tsx` — después de que la extracción local de texto
  tiene éxito (el análisis sigue igual, 100% en el cliente), se dispara **en
  paralelo y sin bloquear** un `POST /documents/upload` con el archivo
  original, solo si `authSource === 'backend'`. Si el backend no responde o
  falla, no afecta el flujo de análisis local existente (mismo patrón que ya
  usa el enriquecimiento semántico en segundo plano).

### Pruebas — `backend/tests/` (pytest + `TestClient` de FastAPI)

Casos cubiertos:
1. RUT válido/inválido (módulo 11) en `/auth/register`.
2. Registro exitoso → el primer usuario queda con `role='administrador'`.
3. Registrar un RUT ya existente → `409`, no crea un segundo usuario en esa
   empresa.
4. Login con credenciales correctas → cookie seteada + body con `role` y
   `company_id`; con credenciales incorrectas → `401`.
5. `GET /auth/me` sin cookie → `401`; con cookie válida → datos del usuario.
6. Subida de documento con extensión válida pero contenido que no coincide
   (ej. `.pdf` sin magic bytes de PDF) → `400`, rechazado.
7. `GET /documents` de la Empresa A nunca incluye documentos subidos por la
   Empresa B (aislamiento por `company_id` del token).

## Fuera de alcance

- PostgreSQL real (Fase 3) — se deja el modelo listo para migrar, pero esta
  fase usa SQLite.
- Cuarentena / antivirus de documentos (Fase 4).
- CSRF completo (documentado como pendiente).
- Flujo de "invitar usuarios" a una empresa ya registrada.
- Cambios al motor de reglas o a la capa de análisis semántico — siguen
  100% en el cliente, sin modificaciones.
- Recuperación de contraseña / verificación de correo.

## Riesgos / decisiones abiertas

Ninguna — diseño aprobado por el usuario el 2026-08-10, incluyendo la
decisión de rechazar con `409` el registro sobre un RUT ya existente en vez
de auto-unir al usuario a la empresa.
