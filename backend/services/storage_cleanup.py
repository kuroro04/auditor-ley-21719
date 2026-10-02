"""Limpieza de archivos huérfanos en almacenamiento definitivo (Fase 6).

Un archivo huérfano es uno que está en STORAGE_DIR sin un Document que lo
referencie. Puede quedar por dos caminos:

- La subida se cortó (caída del proceso) entre move_to_clean() y el commit
  (ver routers/documents.py): el archivo llegó a storage pero la fila y su
  evento de auditoría se perdieron con la transacción.
- Se eliminó un documento (commit hecho) y después falló el borrado del
  archivo en disco.

En ambos casos el archivo no está registrado ni auditado, así que se borra.

Margen de antigüedad: un archivo recién movido cuya subida todavía no hizo
commit también aparece "sin Document". Para no borrarlo, solo se tocan
archivos cuya fecha de modificación supera `antiguedad_minima`. move_to_clean
es un rename, que conserva el mtime de cuando se escribió en cuarentena, así
que el margen debe cubrir la subida entera (escaneo ClamAV incluido); el
default de 15 minutos está muy por encima del timeout de ClamAV.

RLS: corre con la misma conexión de app_user que la aplicación. Recorre las
carpetas de STORAGE_DIR (una por company_id) y fija el contexto de tenant
de cada una antes de consultar sus Document, así que no necesita ningún
privilegio extra ni saltarse las políticas.

Uso:
    python -m services.storage_cleanup [--dry-run] [--antiguedad-minutos N]
"""
import argparse
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from db.models import Document
from db.tenant import set_tenant_context
from services import quarantine_service as qs

logger = logging.getLogger(__name__)

ANTIGUEDAD_MINIMA_DEFAULT = timedelta(minutes=15)


@dataclass
class ResultadoLimpieza:
    borrados: list[Path] = field(default_factory=list)
    omitidos_recientes: list[Path] = field(default_factory=list)
    errores: list[Path] = field(default_factory=list)


def limpiar_archivos_huerfanos(
    db: Session,
    *,
    antiguedad_minima: timedelta = ANTIGUEDAD_MINIMA_DEFAULT,
    dry_run: bool = False,
    ahora: Optional[datetime] = None,
) -> ResultadoLimpieza:
    resultado = ResultadoLimpieza()
    storage = qs.STORAGE_DIR
    if not storage.exists():
        return resultado

    limite = (ahora or datetime.now(timezone.utc)) - antiguedad_minima

    for carpeta in sorted(p for p in storage.iterdir() if p.is_dir()):
        company_id = carpeta.name
        try:
            set_tenant_context(db, company_id)
            referenciados = {
                Path(ruta).name
                for (ruta,) in db.query(Document.stored_path).filter(Document.company_id == company_id)
            }
        finally:
            # Cierra la transacción de esta empresa: el contexto de tenant
            # es local a la transacción y no debe arrastrarse a la siguiente.
            db.rollback()

        for archivo in sorted(p for p in carpeta.iterdir() if p.is_file()):
            if archivo.name in referenciados:
                continue
            mtime = datetime.fromtimestamp(archivo.stat().st_mtime, tz=timezone.utc)
            if mtime > limite:
                resultado.omitidos_recientes.append(archivo)
                continue
            if dry_run:
                resultado.borrados.append(archivo)
                continue
            try:
                qs.secure_delete(archivo)
                resultado.borrados.append(archivo)
                logger.warning('Archivo huérfano borrado (company_id=%s): %s', company_id, archivo.name)
            except Exception:
                logger.exception('No se pudo borrar el archivo huérfano %s', archivo)
                resultado.errores.append(archivo)

    return resultado


def main(argv=None) -> int:
    from db.database import SessionLocal

    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--dry-run', action='store_true', help='Solo lista lo que borraría.')
    parser.add_argument('--antiguedad-minutos', type=int, default=int(ANTIGUEDAD_MINIMA_DEFAULT.total_seconds() // 60))
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        resultado = limpiar_archivos_huerfanos(
            db, antiguedad_minima=timedelta(minutes=args.antiguedad_minutos), dry_run=args.dry_run,
        )
    finally:
        db.close()

    accion = 'Borraría' if args.dry_run else 'Borrados'
    print(f'{accion}: {len(resultado.borrados)} | recientes omitidos: {len(resultado.omitidos_recientes)} '
          f'| errores: {len(resultado.errores)}')
    for ruta in resultado.borrados:
        print(f'  {ruta}')
    return 1 if resultado.errores else 0


if __name__ == '__main__':
    raise SystemExit(main())
