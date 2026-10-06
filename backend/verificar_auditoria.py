#!/usr/bin/env python
"""Verifica la integridad de la cadena de hashes de audit_log (Fase 6).

Corre con el rol audit_verifier, nunca con app_user: la política RLS de
SELECT de app_user solo muestra los eventos del tenant activo, así que con
ese rol la cadena se vería incompleta. audit_verifier tiene SELECT sobre
audit_log y una política propia que le deja ver todos los tenants (ver
db/rls_policies.sql #7), y nada más: sin INSERT, UPDATE ni DELETE.

La URL de conexión se lee de la variable de entorno de proceso
AUDIT_VERIFIER_DATABASE_URL, que NO va en backend/.env: ese archivo lo carga
el backend web, y la credencial del verificador no debe estar al alcance del
proceso que atiende a los tenants.

Uso:
    python verificar_auditoria.py [--desde-id N] [--json]

Códigos de salida:
    0  cadena íntegra
    1  cadena rota (se informa el primer evento inconsistente)
    2  no se pudo verificar (configuración, conexión o rol incorrecto)
"""
import argparse
import json
import os
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

ENV_VAR_URL = 'AUDIT_VERIFIER_DATABASE_URL'
ROL_ESPERADO = 'audit_verifier'
ENV_FILE = Path(__file__).resolve().parent / '.env'

SALIDA_INTEGRA = 0
SALIDA_ROTA = 1
SALIDA_ERROR = 2

_AYUDA_CONFIGURACION = f"""\
Defínela solo en el entorno del proceso que corre la verificación, nunca en
backend/.env. Por ejemplo:

  PowerShell:
    $env:{ENV_VAR_URL} = "postgresql://{ROL_ESPERADO}:<password>@<host>:5432/postgres"
    python verificar_auditoria.py

  Bash:
    {ENV_VAR_URL}="postgresql://{ROL_ESPERADO}:<password>@<host>:5432/postgres" \\
      python verificar_auditoria.py

La contraseña es la que se fijó con AUDIT_VERIFIER_PASSWORD al correr
db/setup_rls.py. En una tarea programada, guárdala en el gestor de secretos
del programador de tareas (o en un archivo legible solo por su usuario)."""


class ErrorDeVerificacion(Exception):
    """La verificación no pudo ejecutarse (no dice nada sobre la cadena)."""


def leer_url_verificador(environ) -> str:
    url = (environ.get(ENV_VAR_URL) or '').strip()
    if not url:
        raise ErrorDeVerificacion(f'La variable de entorno {ENV_VAR_URL} no está definida.\n\n{_AYUDA_CONFIGURACION}')
    if not url.startswith('postgresql'):
        raise ErrorDeVerificacion(
            f'{ENV_VAR_URL} debe apuntar a PostgreSQL con el rol {ROL_ESPERADO} '
            f'(empieza con "postgresql://").'
        )
    return url


def _rechazar_si_esta_en_env_file() -> None:
    """La credencial del verificador en backend/.env anula la separación de roles."""
    from dotenv import dotenv_values

    if ENV_FILE.exists() and dotenv_values(ENV_FILE).get(ENV_VAR_URL):
        raise ErrorDeVerificacion(
            f'{ENV_VAR_URL} aparece en {ENV_FILE}. Quítala de ahí: ese archivo lo '
            f'carga el backend web, que no debe tener la credencial de {ROL_ESPERADO}.\n\n'
            f'{_AYUDA_CONFIGURACION}'
        )


def verificar(url: str, desde_id: Optional[int]):
    """Abre una sesión de solo lectura como audit_verifier y verifica la cadena."""
    from sqlalchemy import create_engine, text
    from sqlalchemy.exc import SQLAlchemyError
    from sqlalchemy.orm import Session

    try:
        from services import audit
    except RuntimeError as exc:
        # core.config es fail-closed (SECRET_KEY, MFA_ENC_KEY, COOKIE_SECURE).
        raise ErrorDeVerificacion(f'Configuración del backend incompleta: {exc}') from exc

    # REPEATABLE READ: toda la verificación ve una sola foto de la tabla,
    # aunque la aplicación siga agregando eventos mientras tanto.
    engine = create_engine(url, isolation_level='REPEATABLE READ')
    try:
        with Session(engine) as db:
            db.execute(text('SET TRANSACTION READ ONLY'))
            rol = db.execute(text('SELECT current_user')).scalar()
            if rol != ROL_ESPERADO:
                raise ErrorDeVerificacion(
                    f'La conexión de {ENV_VAR_URL} entra como "{rol}", no como "{ROL_ESPERADO}". '
                    f'Usa las credenciales del rol {ROL_ESPERADO}.'
                )
            try:
                return audit.verificar_cadena(db, desde_id=desde_id)
            except PermissionError as exc:
                raise ErrorDeVerificacion(str(exc)) from exc
    except SQLAlchemyError as exc:
        # Sin la URL en el mensaje: incluye la contraseña.
        raise ErrorDeVerificacion(f'Error de base de datos: {exc.__class__.__name__}: {getattr(exc, "orig", None) or exc}') from exc
    finally:
        engine.dispose()


def informe_dict(resultado, desde_id: Optional[int], verificado_en: datetime) -> dict:
    datos = asdict(resultado)
    datos['desde_id'] = desde_id
    datos['verificado_en'] = verificado_en.isoformat()
    return datos


def informe_texto(resultado, desde_id: Optional[int], verificado_en: datetime) -> str:
    lineas = [
        'Verificación de la cadena de hashes de audit_log',
        f'  Fecha (UTC):        {verificado_en.isoformat(timespec="seconds")}',
        f'  Desde id:           {desde_id if desde_id is not None else "inicio de la bitácora"}',
        f'  Eventos revisados:  {resultado.eventos_revisados}',
    ]
    if resultado.eventos_revisados:
        lineas.append(f'  Rango de ids:       {resultado.id_primero} – {resultado.id_ultimo}')
    else:
        lineas.append('  Rango de ids:       (sin eventos en el rango pedido)')

    if resultado.intacta:
        lineas.append('  Resultado:          ÍNTEGRA')
    else:
        lineas += [
            '  Resultado:          ROTA',
            f'  Primer evento inconsistente: id {resultado.id_primera_inconsistencia}',
            f'  Motivo:             {resultado.motivo}',
            '  (la verificación se detiene en la primera inconsistencia: los eventos',
            '   posteriores no se revisaron)',
        ]
    return '\n'.join(lineas)


def _id_positivo(valor: str) -> int:
    numero = int(valor)
    if numero < 1:
        raise argparse.ArgumentTypeError('debe ser un entero mayor o igual a 1')
    return numero


def main(argv=None, environ=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--desde-id', type=_id_positivo, metavar='N',
                        help='Verifica desde el evento con este id (enlazándolo con el anterior).')
    parser.add_argument('--json', action='store_true', help='Imprime el informe en JSON.')
    args = parser.parse_args(argv)

    # La URL se lee antes de importar el backend: core.config hace
    # load_dotenv() al importarse, y así una copia en backend/.env no puede
    # colarse en os.environ sin que la detectemos.
    try:
        url = leer_url_verificador(os.environ if environ is None else environ)
        _rechazar_si_esta_en_env_file()
        resultado = verificar(url, args.desde_id)
    except ErrorDeVerificacion as exc:
        print(f'ERROR: no se pudo verificar la bitácora.\n{exc}', file=sys.stderr)
        return SALIDA_ERROR

    verificado_en = datetime.now(timezone.utc)
    if args.json:
        print(json.dumps(informe_dict(resultado, args.desde_id, verificado_en), ensure_ascii=False, indent=2))
    else:
        print(informe_texto(resultado, args.desde_id, verificado_en))
    return SALIDA_INTEGRA if resultado.intacta else SALIDA_ROTA


if __name__ == '__main__':
    raise SystemExit(main())
