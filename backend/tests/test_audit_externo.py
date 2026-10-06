"""Copia externa de la bitácora en Better Stack (services/audit_externo.py).

El HTTP se simula con httpx.MockTransport: corre el enviador real (cola,
hilo, reintentos), pero ninguna petición sale de la máquina.
"""
import json
import logging
import threading

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import core.config
import db.models  # noqa: F401 — registra los modelos en Base antes de create_all
from db.database import Base
from db.models import AuditLog
from services import audit, audit_externo

TOKEN = 'token-de-prueba'
HOST = 's1234.eu-nbg-2.betterstackdata.com'
PASSWORD = 'Clave-Segura123!'


@pytest.fixture(autouse=True)
def _enviador_global_aislado(monkeypatch):
    # Cada test parte sin enviador inicializado y lo restaura al terminar.
    monkeypatch.setattr(audit_externo, '_enviador', None)
    monkeypatch.setattr(audit_externo, '_enviador_inicializado', False)


@pytest.fixture()
def db():
    engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


class BetterStackSimulado:
    """Registra cada POST y responde lo que diga `responder`."""

    def __init__(self, responder=None):
        self.peticiones: list[httpx.Request] = []
        self._responder = responder or (lambda request: httpx.Response(202))
        self._lock = threading.Lock()

    def __call__(self, request: httpx.Request) -> httpx.Response:
        with self._lock:
            self.peticiones.append(request)
        return self._responder(request)

    @property
    def eventos(self) -> list[dict]:
        return [evento for p in self.peticiones for evento in json.loads(p.content)]


def _instalar(simulado: BetterStackSimulado, **kwargs) -> audit_externo.EnviadorBetterStack:
    enviador = audit_externo.EnviadorBetterStack(
        HOST, TOKEN,
        cliente_http=httpx.Client(transport=httpx.MockTransport(simulado)),
        espera_base=0.01,
        **kwargs,
    )
    audit_externo.configurar_enviador(enviador)
    return enviador


def _registrar_empresa(client):
    return client.post('/auth/register', json={
        'rut': '11.111.111-1',
        'nombre_empresa': 'Empresa Test',
        'email': 'admin@empresatest.cl',
        'password': PASSWORD,
        'sector': 'tecnologia',
    })


def _filas(engine) -> list[AuditLog]:
    s = sessionmaker(bind=engine)()
    try:
        return s.query(AuditLog).order_by(AuditLog.id).all()
    finally:
        s.close()


# --- Qué se envía -------------------------------------------------------------

def test_envia_tras_commit_con_hashes_y_token(db):
    simulado = BetterStackSimulado()
    enviador = _instalar(simulado)

    uno = audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'exito', user_id='u1', company_id='c1',
                                 ip_origen='10.0.0.1', detalle={'metodo': 'password'})
    dos = audit.registrar_evento(db, audit.EVENTO_CIERRE_SESION, 'exito', user_id='u1', company_id='c1')
    db.commit()
    enviador.detener()

    peticion = simulado.peticiones[0]
    assert str(peticion.url) == f'https://{HOST}'
    assert peticion.headers['Authorization'] == f'Bearer {TOKEN}'

    enviados = simulado.eventos
    assert [e['id'] for e in enviados] == [uno.id, dos.id]
    assert enviados[0]['hash_previo'] == audit.HASH_GENESIS
    assert enviados[0]['hash_evento'] == uno.hash_evento
    assert enviados[1]['hash_previo'] == uno.hash_evento
    assert enviados[1]['hash_evento'] == dos.hash_evento
    assert enviados[0]['evento'] == audit.EVENTO_LOGIN_EXITOSO
    assert enviados[0]['detalle'] == {'metodo': 'password'}
    assert enviados[0]['dt'] == enviados[0]['ocurrido_en']


def test_el_payload_son_solo_las_columnas_de_audit_log(db):
    simulado = BetterStackSimulado()
    enviador = _instalar(simulado)

    audit.registrar_evento(db, audit.EVENTO_DOCUMENTO_SUBIDO, 'exito', user_id='u1', company_id='c1',
                           detalle={'filename': 'x.pdf', 'file_hash': 'abc', 'veredicto': 'limpio'})
    db.commit()
    enviador.detener()

    columnas = set(AuditLog.__table__.columns.keys())
    (enviado,) = simulado.eventos
    # `dt` es una copia de ocurrido_en (fecha del evento para Better Stack).
    assert set(enviado) == columnas | {'dt'}


def test_los_hashes_enviados_permiten_recalcular_la_cadena(db):
    # Lo que justifica enviarlos: con la copia externa sola se puede
    # recalcular cada hash_evento y contrastarlo con el local.
    simulado = BetterStackSimulado()
    enviador = _instalar(simulado)

    audit.registrar_evento(db, audit.EVENTO_LOGIN_FALLIDO, 'fallo', ip_origen='10.0.0.9', detalle={'motivo': 'x'})
    db.commit()
    enviador.detener()

    (e,) = simulado.eventos
    fila = db.query(AuditLog).one()
    recalculado = audit._calcular_hash(
        evento=e['evento'], resultado=e['resultado'], user_id=e['user_id'], company_id=e['company_id'],
        ip_origen=e['ip_origen'], detalle=e['detalle'], ocurrido_en=fila.ocurrido_en, hash_previo=e['hash_previo'],
    )
    assert recalculado == e['hash_evento'] == fila.hash_evento


def test_rollback_no_envia_nada(db):
    simulado = BetterStackSimulado()
    enviador = _instalar(simulado)

    audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'exito', user_id='u1')
    db.rollback()
    audit.registrar_evento(db, audit.EVENTO_CIERRE_SESION, 'exito', user_id='u1')
    db.commit()
    enviador.detener()

    assert [e['evento'] for e in simulado.eventos] == [audit.EVENTO_CIERRE_SESION]


def test_savepoint_deshecho_no_envia_sus_eventos(db):
    simulado = BetterStackSimulado()
    enviador = _instalar(simulado)

    audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'exito', user_id='u1')
    savepoint = db.begin_nested()
    audit.registrar_evento(db, audit.EVENTO_MFA_RECHAZADO, 'fallo', user_id='u1')
    savepoint.rollback()
    db.commit()
    enviador.detener()

    assert [e['evento'] for e in simulado.eventos] == [audit.EVENTO_LOGIN_EXITOSO]


def test_endpoint_real_envia_el_evento_que_quedo_en_la_base(client):
    simulado = BetterStackSimulado()
    enviador = _instalar(simulado)

    assert _registrar_empresa(client).status_code in (200, 201)
    enviador.detener()

    (fila,) = _filas(client.db_engine)
    (enviado,) = simulado.eventos
    assert enviado['id'] == fila.id
    assert enviado['evento'] == audit.EVENTO_EMPRESA_REGISTRADA
    assert enviado['hash_evento'] == fila.hash_evento
    assert enviado['hash_previo'] == fila.hash_previo


# --- Fallos del servicio externo ---------------------------------------------

def test_better_stack_caido_no_rompe_la_operacion(client, caplog):
    def caido(request):
        raise httpx.ConnectError('connection refused', request=request)

    simulado = BetterStackSimulado(caido)
    enviador = _instalar(simulado, intentos=3)

    with caplog.at_level(logging.ERROR, logger='services.audit_externo'):
        res = _registrar_empresa(client)
        enviador.detener()

    assert res.status_code in (200, 201)
    (fila,) = _filas(client.db_engine)  # el evento sigue en la base local
    assert len(simulado.peticiones) == 3  # reintentó antes de rendirse
    assert fila.hash_evento in caplog.text
    assert 'ConnectError' in caplog.text


def test_better_stack_lento_no_bloquea_la_peticion(client):
    # Better Stack "cuelga" hasta que el test lo libere: si el envío fuera
    # síncrono, el POST de registro no podría responder mientras tanto.
    recibido = threading.Event()
    liberar = threading.Event()
    respondido = threading.Event()

    def lento(request):
        recibido.set()
        liberar.wait(timeout=10)
        respondido.set()
        return httpx.Response(202)

    simulado = BetterStackSimulado(lento)
    enviador = _instalar(simulado)
    try:
        res = _registrar_empresa(client)
        assert res.status_code in (200, 201)
        assert recibido.wait(timeout=5)  # el envío está en curso...
        assert not respondido.is_set()    # ...y Better Stack aún no responde, pero el usuario ya tuvo respuesta
    finally:
        liberar.set()
        enviador.detener()

    assert len(simulado.eventos) == 1


@pytest.mark.parametrize('status, intentos_esperados', [(500, 3), (429, 3), (401, 1)])
def test_errores_http_reintenta_solo_si_tiene_sentido(db, caplog, status, intentos_esperados):
    simulado = BetterStackSimulado(lambda request: httpx.Response(status))
    enviador = _instalar(simulado, intentos=3)

    with caplog.at_level(logging.ERROR, logger='services.audit_externo'):
        registro = audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'exito', user_id='u1')
        db.commit()
        enviador.detener()

    assert len(simulado.peticiones) == intentos_esperados
    assert f'HTTP {status}' in caplog.text
    assert registro.hash_evento in caplog.text


def test_cola_llena_descarta_y_registra_sin_bloquear(caplog):
    liberar = threading.Event()
    simulado = BetterStackSimulado(lambda request: (liberar.wait(timeout=10), httpx.Response(202))[1])
    enviador = _instalar(simulado, tam_cola=1, tam_lote=1)
    try:
        with caplog.at_level(logging.ERROR, logger='services.audit_externo'):
            for i in range(1, 6):
                enviador.encolar({'id': i, 'hash_evento': f'h{i}'})  # no debe bloquear ni lanzar
        assert 'Cola de envío a Better Stack llena' in caplog.text
    finally:
        liberar.set()
        enviador.detener()


def test_fallo_al_programar_envio_no_afecta_evento_critico(db, monkeypatch, caplog):
    _instalar(BetterStackSimulado())

    def roto(*_a, **_k):
        raise RuntimeError('fallo simulado del envío externo')

    monkeypatch.setattr(audit_externo, 'programar_envio', roto)

    with caplog.at_level(logging.ERROR, logger='services.audit'):
        registro = audit.registrar_evento(
            db, audit.EVENTO_DOCUMENTO_SUBIDO, 'exito', user_id='u1', company_id='c1',
            detalle={'filename': 'x.pdf', 'file_hash': 'abc', 'veredicto': 'limpio'},
        )
        db.commit()

    assert registro is not None
    assert db.query(AuditLog).count() == 1
    assert 'copia externa' in caplog.text


# --- Sin configuración --------------------------------------------------------

@pytest.mark.parametrize('token, host', [(None, None), (TOKEN, None), (None, HOST)])
def test_sin_variables_el_envio_queda_desactivado(monkeypatch, db, token, host):
    monkeypatch.setattr(core.config, 'BETTERSTACK_SOURCE_TOKEN', token)
    monkeypatch.setattr(core.config, 'BETTERSTACK_INGEST_HOST', host)

    assert audit_externo.obtener_enviador() is None

    registro = audit.registrar_evento(db, audit.EVENTO_LOGIN_EXITOSO, 'exito', user_id='u1')
    assert audit_externo._CLAVE_PENDIENTES not in db.info
    db.commit()

    assert registro is not None
    assert audit.verificar_cadena(db).intacta


def test_sin_variables_la_api_funciona_igual(monkeypatch, client):
    monkeypatch.setattr(core.config, 'BETTERSTACK_SOURCE_TOKEN', None)
    monkeypatch.setattr(core.config, 'BETTERSTACK_INGEST_HOST', None)

    assert _registrar_empresa(client).status_code in (200, 201)
    res = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': PASSWORD})

    assert res.status_code == 200
    assert len(_filas(client.db_engine)) == 2
    assert audit_externo.obtener_enviador() is None


def test_con_ambas_variables_se_crea_el_enviador(monkeypatch):
    monkeypatch.setattr(core.config, 'BETTERSTACK_SOURCE_TOKEN', TOKEN)
    monkeypatch.setattr(core.config, 'BETTERSTACK_INGEST_HOST', HOST)

    enviador = audit_externo.obtener_enviador()

    assert isinstance(enviador, audit_externo.EnviadorBetterStack)
    assert enviador._url == f'https://{HOST}'


def test_en_modo_testing_config_ignora_las_variables_del_entorno():
    # conftest fija TESTING=1: aunque backend/.env tenga las credenciales
    # reales, la suite nunca manda eventos de prueba a Better Stack.
    assert core.config.TESTING
    assert core.config.BETTERSTACK_SOURCE_TOKEN is None
    assert core.config.BETTERSTACK_INGEST_HOST is None
