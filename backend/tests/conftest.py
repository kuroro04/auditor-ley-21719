import os

# Modo de excepción explícito para tests: debe fijarse antes de importar
# `main` (y por lo tanto `core.config`), así los tests no dependen de tener
# un backend/.env real ni se rompen por el fail-closed de SECRET_KEY/COOKIE_SECURE.
os.environ.setdefault('TESTING', '1')

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main as main_module
import services.scan_audit_log as scan_audit_log
from core.deps import get_clamav_client
from db.database import Base, get_db
from tests.fakes import FakeClamdLimpio


@pytest.fixture(autouse=True)
def _bitacora_de_escaneo_aislada(tmp_path, monkeypatch):
    # Ningún test debe escribir en el log de auditoría real
    # (backend/logs/document_scans.log): cada test escribe en su propio
    # archivo temporal, para no mezclar datos de prueba con la bitácora real.
    monkeypatch.setattr(scan_audit_log, 'SCAN_LOG_PATH', tmp_path / 'document_scans.log')


@pytest.fixture()
def client():
    # Cada test recibe su propia base SQLite en memoria, aislada de
    # backend.db (la base "real") y de los demás tests.
    engine = create_engine(
        'sqlite:///:memory:',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main_module.app.dependency_overrides[get_db] = override_get_db
    # ClamAV falso por defecto: los tests no dependen de un contenedor
    # real corriendo. Detecta EICAR igual que clamd de verdad.
    main_module.app.dependency_overrides[get_clamav_client] = lambda: FakeClamdLimpio()
    with TestClient(main_module.app) as test_client:
        yield test_client
    main_module.app.dependency_overrides.clear()
