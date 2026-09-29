-- Row-Level Security para aislamiento multi-tenant (Fase 3).
-- Se aplica una sola vez con el rol admin (postgres), vía backend/db/setup_rls.py.
-- El rol app_user (creado por separado, con contraseña) es el único que la
-- app usa en runtime, y NO tiene BYPASSRLS, así que estas políticas sí le
-- aplican de verdad.

-- 1. Permisos mínimos del rol de aplicación sobre las tablas.
GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON companies, users, documents TO app_user;

-- 1b. Fase 5 — columnas del segundo factor TOTP. Idempotente (IF NOT EXISTS):
--     create_all() de setup_rls.py crea tablas nuevas pero no agrega columnas
--     a `users` si ya existía. Deben crearse ANTES de get_user_by_email, que
--     las selecciona.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes text;

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
--
-- DROP previo: CREATE OR REPLACE no puede cambiar el tipo de retorno de una
-- función existente (p. ej. al agregar las columnas MFA de la Fase 5), así
-- que primero se elimina. IF EXISTS mantiene la idempotencia.
DROP FUNCTION IF EXISTS get_user_by_email(text);
CREATE OR REPLACE FUNCTION get_user_by_email(p_email text)
RETURNS TABLE (
    id text, company_id text, email text, password_hash text,
    role text, onboarding_completed boolean,
    mfa_enabled boolean, mfa_secret_enc text, mfa_backup_codes text,
    created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, company_id, email, password_hash, role, onboarding_completed,
           mfa_enabled, mfa_secret_enc, mfa_backup_codes, created_at
    FROM users
    WHERE email = p_email;
$$;

REVOKE ALL ON FUNCTION get_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_by_email(text) TO app_user;

-- 5. Fase 6 — bitácora de auditoría (audit_log). Tiene RLS igual que
--    users/documents (el aislamiento por tenant no tiene excepciones en
--    este proyecto), con una diferencia en el INSERT: la aplicación
--    también escribe eventos "de sistema" sin tenant resuelto todavía
--    —company_id NULL—, como un login fallido (no se sabe a qué empresa
--    pertenece el intento) o un token de MFA que ni siquiera decodifica.
--    Una política calcada de tenant_isolation_users/documents
--    (company_id = current_setting(...)) bloquearía justo esas filas: NULL
--    = valor da NULL, no true. Por eso el WITH CHECK acepta también
--    company_id IS NULL. El SELECT no tiene esa excepción a propósito: los
--    eventos globales no son visibles desde ningún tenant vía RLS (si algún
--    día hiciera falta consultarlos, sería con una función SECURITY
--    DEFINER acotada, igual que get_user_by_email más arriba).
--    Sin políticas de UPDATE ni DELETE: con RLS habilitado, cualquier
--    comando sin política propia queda denegado por defecto — el REVOKE de
--    abajo es una segunda barrera (a nivel de permiso, no de fila) para que
--    "append-only" se cumpla aunque un bug de la app lo intentara.
--
--    NULLIF(..., '')::uuid en vez de current_setting(...)::uuid a secas:
--    verificado contra la base real que, a través del pooler de Supabase,
--    cuando NUNCA se llamó set_tenant_context() en la conexión,
--    current_setting('app.current_company_id', true) no devuelve NULL sino
--    '' (string vacío) — a diferencia de una conexión directa a Postgres,
--    donde sí daría NULL. ''::uuid no fallback-ea a NULL: lanza un error
--    ("invalid input syntax for type uuid") que aborta la consulta entera,
--    ANTES de que Postgres llegue a evaluar el OR company_id IS NULL de más
--    abajo. NULLIF convierte ese '' en NULL antes del cast, así que
--    current_setting(...)::uuid da NULL limpiamente (y la comparación
--    company_id = NULL también da NULL/false, sin reventar). Esto afecta
--    igual al SELECT: sin el NULLIF, hasta un SELECT count(*) sin contexto
--    de tenant fijado revienta con error de base de datos en vez de
--    devolver 0 filas.
--    NOTA: esta sección asume que audit_log ya existe con `id bigserial`
--    (secuencia `audit_log_id_seq`, el nombre por defecto de Postgres para
--    esa columna) y `company_id uuid`. Verificar contra la base real antes
--    de aplicar — ver también la migración suelta para políticas que ya
--    existían con otro nombre/definición.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select_tenant ON audit_log;
CREATE POLICY audit_log_select_tenant ON audit_log
    FOR SELECT
    USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

DROP POLICY IF EXISTS audit_log_insert_tenant ON audit_log;
CREATE POLICY audit_log_insert_tenant ON audit_log
    FOR INSERT
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
        OR company_id IS NULL
    );

GRANT SELECT, INSERT ON audit_log TO app_user;
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO app_user;
