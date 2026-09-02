# Fase 3: Migración a PostgreSQL (Supabase) + Row-Level Security

## Contexto y objetivo

DataShield 21.719 usa SQLAlchemy sobre SQLite. El aislamiento multi-tenant
hoy vive solo en la capa de aplicación (cada router filtra por
`current.company_id`). Esta fase agrega una segunda capa de defensa a nivel
de base de datos: PostgreSQL (Supabase) + Row-Level Security (RLS), sin
romper la compatibilidad con SQLite para tests locales.

## Decisión clave: dos roles de base de datos

La connection string de Supabase que existe hoy usa el rol `postgres`, que
es **superusuario**. En PostgreSQL, los superusuarios (y cualquier rol con
`BYPASSRLS`) **siempre** ignoran las políticas RLS, sin importar cómo estén
configuradas. Si el backend siguiera conectándose como `postgres`, RLS no
tendría ningún efecto real.

Por eso se crean dos roles:

- **`postgres`** (ya existe, superusuario): se usa una única vez, desde un
  script de setup administrativo, para crear las tablas, crear el rol de
  aplicación, activar RLS y definir las políticas. Su connection string
  **no** se guarda en ningún `.env` que use el backend en runtime.
- **`app_user`** (nuevo, sin `BYPASSRLS`): password aleatoria fuerte,
  generada una vez y guardada solo en `backend/.env` como `DATABASE_URL`.
  Únicamente tiene permisos `SELECT/INSERT/UPDATE/DELETE` sobre
  `companies`, `users`, `documents` — nada de DDL ni de administración de
  roles. Es el rol que usa el backend siempre.

## Mecanismo de aislamiento por tenant (`SET LOCAL`)

Cada request autenticado ejecuta `SET LOCAL app.current_company_id =
'<company_id>'` como primera sentencia de su transacción SQL, a través de
una nueva dependencia FastAPI `get_tenant_db` (envuelve `get_db` +
`get_current_user`). `SET LOCAL` solo dura la transacción actual: aunque
SQLAlchemy reutilice conexiones del pool entre requests, no hay forma de
que el contexto de una empresa se filtre a la siguiente request.

Las políticas RLS en `users` y `documents` exigen:
`company_id = current_setting('app.current_company_id', true)`
para `SELECT`, `UPDATE`, `DELETE` e `INSERT` (vía `USING` y `WITH CHECK`).

`companies` queda **fuera** de RLS: el aislamiento pedido es sobre usuarios
y documentos, y cada usuario ya solo consulta su propia empresa por un ID
que conoce desde su JWT (no hay superficie de fuga cruzada ahí).

## Dos excepciones controladas (documentadas, no bypass general)

1. **`POST /auth/register`**: no existe contexto de tenant todavía porque
   se está creando la empresa. El router genera el `company_id`, llama
   `set_tenant_context(db, company_id)` y **luego** inserta el usuario —
   todo dentro de la misma transacción. No hay bypass de RLS.

2. **`POST /auth/login`**: hay que buscar al usuario por email *antes* de
   saber su `company_id` (el email es único a nivel global, no por
   empresa). Con RLS estricto esa consulta siempre devolvería 0 filas
   porque no hay contexto que fijar todavía. Solución: una función SQL
   `SECURITY DEFINER` (`get_user_by_email`), creada por el rol admin, que
   ejecuta exactamente esa búsqueda puntual (y nada más). `app_user` solo
   tiene permiso de **ejecutar** la función, no de leer `users`
   directamente sin contexto. Es una puerta angosta y auditable.

## Cambios de código

- `backend/requirements.txt`: agregar `psycopg2-binary`.
- `backend/core/config.py`: sin cambios de fondo — `DATABASE_URL` ya se lee
  de entorno; se sigue soportando cualquier dialecto soportado por
  SQLAlchemy.
- `backend/db/database.py`: `connect_args` condicional ya existe para
  SQLite; no requiere cambios para Postgres.
- `backend/db/tenant.py` (nuevo): helper `set_tenant_context(db, company_id)`.
- `backend/core/deps.py`: nueva dependencia `get_tenant_db` que combina
  `get_db` + `get_current_user` y fija el contexto de tenant.
- `backend/routers/documents.py`, `auth.py` (`/me`, `/complete-onboarding`):
  usar `get_tenant_db` en vez de `get_db` + `get_current_user` por
  separado.
- `backend/routers/auth.py` (`/register`, `/login`): manejo explícito
  descrito arriba.
- `backend/db/setup_rls.py` (nuevo, uso manual/administrativo): script que
  usa el rol `postgres` para crear tablas, rol `app_user`, políticas RLS y
  la función `get_user_by_email`. No se ejecuta en el arranque normal del
  backend.
- `backend/db/rls_policies.sql` (nuevo): el SQL real ejecutado, para que
  quede documentado y sea repetible/auditable.

## Testing

- Tests existentes: sin cambios, siguen en SQLite en memoria.
- `backend/tests/test_rls_isolation.py` (nuevo): se salta automáticamente
  si no hay una variable de entorno con una URL de Postgres de pruebas
  (`DATABASE_URL` apuntando a Postgres). Si está presente, corre contra
  Supabase real usando el rol `app_user`: crea 2 empresas, y verifica que
  la empresa B obtiene 0 filas al intentar leer datos de la empresa A, y
  que un INSERT con `company_id` que no coincide con el contexto fijado
  falla.

## Compatibilidad SQLite

El código de la aplicación (modelos, routers) sigue funcionando igual
contra SQLite: `set_tenant_context` y `get_tenant_db` ejecutan `SET LOCAL`
solo cuando el dialecto es PostgreSQL (con SQLite es un no-op), así que los
tests locales en SQLite en memoria no requieren ningún contexto de tenant
para funcionar — el aislamiento ahí sigue siendo responsabilidad exclusiva
de la capa de aplicación, como hoy.
