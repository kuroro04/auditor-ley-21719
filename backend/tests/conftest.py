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
from db.database import Base, get_db


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
    with TestClient(main_module.app) as test_client:
        yield test_client
    main_module.app.dependency_overrides.clear()
