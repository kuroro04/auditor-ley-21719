"""Script de configuración administrativa para PostgreSQL/Supabase (Fase 3).

Se ejecuta A MANO, una sola vez (o cada vez que cambien las políticas),
usando el rol `postgres` (superusuario) de Supabase. Nunca se ejecuta como
parte del arranque normal del backend, y su connection string admin NUNCA
se guarda en backend/.env — solo se pasa como variable de entorno de
proceso al momento de correr este script.

Uso (PowerShell):
    $env:DATABASE_URL_ADMIN = "postgresql://postgres:...@host:5432/postgres"
    $env:APP_USER_PASSWORD = "<password-generada-para-app_user>"
    $env:AUDIT_VERIFIER_PASSWORD = "<password-para-audit_verifier>"  # opcional
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

            # Opcional: el rol audit_verifier (rls_policies.sql #7) se crea
            # NOLOGIN; solo se habilita si se entrega su contraseña.
            verifier_password = os.environ.get('AUDIT_VERIFIER_PASSWORD')
            if verifier_password:
                print('   Habilitando LOGIN del rol audit_verifier...')
                cur.execute(
                    sql.SQL('ALTER ROLE audit_verifier WITH LOGIN PASSWORD {}').format(
                        sql.Literal(verifier_password)
                    )
                )

        print('Listo.')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
