"""Zona de cuarentena — Fase 4, carga segura.

Todo archivo subido se guarda primero acá, separado del almacenamiento
definitivo (STORAGE_DIR). Solo se traslada a STORAGE_DIR si ClamAV lo
declaró limpio; si no, se borra de forma segura.
"""
import os
import secrets
import uuid
from pathlib import Path

from core.config import QUARANTINE_DIR, STORAGE_DIR


def _carpeta_de_empresa(base: Path, company_id: str) -> Path:
    carpeta = base / company_id
    carpeta.mkdir(parents=True, exist_ok=True)
    return carpeta


def write_to_quarantine(company_id: str, filename: str, content: bytes) -> Path:
    carpeta = _carpeta_de_empresa(QUARANTINE_DIR, company_id)
    ruta = carpeta / f'{uuid.uuid4()}_{filename}'
    ruta.write_bytes(content)
    return ruta


def clean_destination(quarantine_path: Path, company_id: str) -> Path:
    """Ruta definitiva que tendrá el archivo, sin moverlo todavía.

    Permite registrar el Document (y su evento de auditoría) con su
    stored_path antes de sacar el archivo de la cuarentena.
    """
    return _carpeta_de_empresa(STORAGE_DIR, company_id) / quarantine_path.name


def move_to_clean(quarantine_path: Path, company_id: str) -> Path:
    destino = clean_destination(quarantine_path, company_id)
    quarantine_path.replace(destino)
    return destino


def secure_delete(path: Path) -> None:
    """Borrado seguro best-effort: sobrescribe el contenido antes de eliminar.

    No es una garantía absoluta en discos SSD con wear-leveling, pero
    evita que un undelete trivial recupere un archivo infectado o
    rechazado desde la carpeta de cuarentena.
    """
    if not path.exists():
        return
    size = path.stat().st_size
    with open(path, 'r+b') as f:
        f.write(secrets.token_bytes(size))
        f.flush()
        os.fsync(f.fileno())
    path.unlink()
