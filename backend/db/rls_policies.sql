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
