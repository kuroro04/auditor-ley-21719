import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from db.database import Base
import db.models  # noqa: F401 — registra los modelos en Base antes de create_all
from services import audit


@pytest.fixture()
def db():
    engine = create_engine(
        'sqlite:///:memory:',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = Session()
    yield session
    session.close()


def test_primer_evento_usa_hash_genesis_como_previo(db):
    registro = audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'ok', user_id='u1')
    db.commit()

    assert registro.hash_previo == audit.HASH_GENESIS
    assert len(registro.hash_evento) == 64


def test_eventos_sucesivos_se_encadenan(db):
    uno = audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'ok', user_id='u1')
    dos = audit.registrar_evento(db, audit.EVENTO_CIERRE_SESION, 'ok', user_id='u1')
    db.commit()

    assert dos.hash_previo == uno.hash_evento
    assert dos.hash_evento != uno.hash_evento


def test_hash_es_determinista_y_sensible_al_detalle(db):
    a = audit._calcular_hash(
        evento='e', resultado='r', user_id='u', company_id='c', ip_origen='1.1.1.1',
        detalle={'b': 1, 'a': 2}, ocurrido_en=uno_fijo(), hash_previo=audit.HASH_GENESIS,
    )
    b = audit._calcular_hash(
        evento='e', resultado='r', user_id='u', company_id='c', ip_origen='1.1.1.1',
        detalle={'a': 2, 'b': 1}, ocurrido_en=uno_fijo(), hash_previo=audit.HASH_GENESIS,
    )
    c = audit._calcular_hash(
        evento='e', resultado='r', user_id='u', company_id='c', ip_origen='1.1.1.1',
        detalle={'a': 2, 'b': 999}, ocurrido_en=uno_fijo(), hash_previo=audit.HASH_GENESIS,
    )

    assert a == b  # el orden de las claves no debe afectar el hash
    assert a != c  # un detalle distinto sí debe cambiar el hash


def uno_fijo():
    from datetime import datetime, timezone
    return datetime(2026, 1, 1, tzinfo=timezone.utc)


def test_verificar_cadena_intacta(db):
    audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'ok', user_id='u1')
    audit.registrar_evento(db, audit.EVENTO_MFA_SUPERADO, 'ok', user_id='u1')
    audit.registrar_evento(db, audit.EVENTO_CIERRE_SESION, 'ok', user_id='u1')
    db.commit()

    resultado = audit.verificar_cadena(db)

    assert resultado.intacta is True
    assert resultado.eventos_revisados == 3
    assert resultado.id_primera_inconsistencia is None


def test_verificar_cadena_detecta_hash_evento_alterado(db):
    audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'ok', user_id='u1')
    segundo = audit.registrar_evento(db, audit.EVENTO_LOGIN_FALLIDO, 'fallo', user_id='u1')
    db.commit()

    segundo.hash_evento = 'f' * 64
    db.commit()

    resultado = audit.verificar_cadena(db)

    assert resultado.intacta is False
    assert resultado.id_primera_inconsistencia == segundo.id
    assert 'hash_evento' in resultado.motivo


def test_verificar_cadena_detecta_hash_previo_alterado(db):
    audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'ok', user_id='u1')
    segundo = audit.registrar_evento(db, audit.EVENTO_LOGIN_FALLIDO, 'fallo', user_id='u1')
    db.commit()

    segundo.hash_previo = 'a' * 64
    db.commit()

    resultado = audit.verificar_cadena(db)

    assert resultado.intacta is False
    assert resultado.id_primera_inconsistencia == segundo.id
    assert 'hash_previo' in resultado.motivo


def test_verificar_cadena_respeta_desde_id(db):
    uno = audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'ok', user_id='u1')
    dos = audit.registrar_evento(db, audit.EVENTO_LOGIN_FALLIDO, 'fallo', user_id='u1')
    db.commit()

    resultado = audit.verificar_cadena(db, desde_id=dos.id)

    assert resultado.intacta is True
    assert resultado.eventos_revisados == 1


def test_evento_no_critico_no_propaga_excepcion(db, monkeypatch):
    def query_rota(*_a, **_k):
        raise RuntimeError('fallo simulado de base de datos')

    monkeypatch.setattr(db, 'query', query_rota)

    resultado = audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'ok', user_id='u1')

    assert resultado is None


def test_evento_critico_propaga_excepcion(db, monkeypatch):
    def query_rota(*_a, **_k):
        raise RuntimeError('fallo simulado de base de datos')

    monkeypatch.setattr(db, 'query', query_rota)

    with pytest.raises(RuntimeError):
        audit.registrar_evento(
            db, audit.EVENTO_DOCUMENTO_SUBIDO, 'ok', user_id='u1',
            detalle={'filename': 'x.pdf', 'file_hash': 'abc', 'veredicto': 'limpio'},
        )
