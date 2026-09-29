"""Verifica que los endpoints de autenticación (routers/auth.py) registran
los eventos de auditoría esperados, con los datos correctos y sin filtrar
información sensible en `detalle` (Fase 6).
"""
import json

import pyotp
from sqlalchemy.orm import sessionmaker

from db.models import AuditLog
from services import audit

PASSWORD = 'Clave-Segura123!'


def _eventos(client):
    Session = sessionmaker(bind=client.db_engine)
    db = Session()
    try:
        return db.query(AuditLog).order_by(AuditLog.id).all()
    finally:
        db.close()


def _registrar(client, email='admin@empresatest.cl', rut='11.111.111-1'):
    return client.post('/auth/register', json={
        'rut': rut,
        'nombre_empresa': 'Empresa Test',
        'email': email,
        'password': PASSWORD,
        'sector': 'tecnologia',
    })


def _activar_mfa(client):
    setup = client.post('/auth/mfa/setup')
    secret = setup.json()['secret_base32']
    codigo = pyotp.TOTP(secret).now()
    activate = client.post('/auth/mfa/activate', json={'code': codigo})
    return secret, activate.json()['backup_codes']


def test_registro_de_empresa_queda_auditado(client):
    res = _registrar(client)
    company_id = res.json()['company_id']

    eventos = _eventos(client)
    assert len(eventos) == 1
    evento = eventos[0]
    assert evento.evento == audit.EVENTO_EMPRESA_REGISTRADA
    assert evento.resultado == 'exito'
    assert evento.company_id == company_id
    assert evento.user_id is not None


def test_login_exitoso_queda_auditado(client):
    _registrar(client)

    res = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': PASSWORD})
    assert res.status_code == 200

    eventos = _eventos(client)
    ultimo = eventos[-1]
    assert ultimo.evento == audit.EVENTO_LOGIN_EXITOSO
    assert ultimo.resultado == 'exito'
    assert ultimo.user_id is not None
    assert ultimo.company_id is not None


def test_login_fallido_queda_auditado_con_email_sin_password(client):
    _registrar(client)

    res = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': 'incorrecta'})
    assert res.status_code == 401

    eventos = _eventos(client)
    ultimo = eventos[-1]
    assert ultimo.evento == audit.EVENTO_LOGIN_FALLIDO
    assert ultimo.resultado == 'fallo'
    # Sin usuario resuelto con certeza, no hay tenant que fijar: el evento
    # igual debe quedar registrado con company_id nulo (no bloqueado por RLS).
    assert ultimo.user_id is None
    assert ultimo.company_id is None
    assert ultimo.detalle['email_intentado'] == 'admin@empresatest.cl'
    assert 'incorrecta' not in json.dumps(ultimo.detalle)


def test_login_con_email_inexistente_tambien_se_audita_sin_contexto_de_tenant(client):
    res = client.post('/auth/login', json={'email': 'nadie@empresatest.cl', 'password': 'lo-que-sea'})
    assert res.status_code == 401

    eventos = _eventos(client)
    assert len(eventos) == 1
    assert eventos[0].evento == audit.EVENTO_LOGIN_FALLIDO
    assert eventos[0].company_id is None


def test_mfa_activado_queda_auditado(client):
    _registrar(client)
    _activar_mfa(client)

    eventos = _eventos(client)
    activados = [e for e in eventos if e.evento == audit.EVENTO_MFA_ACTIVADO]
    assert len(activados) == 1
    assert activados[0].resultado == 'exito'
    assert activados[0].user_id is not None


def test_mfa_desactivado_queda_auditado(client):
    _registrar(client)
    _activar_mfa(client)

    res = client.post('/auth/mfa/disable', json={'password': PASSWORD})
    assert res.status_code == 204

    eventos = _eventos(client)
    desactivados = [e for e in eventos if e.evento == audit.EVENTO_MFA_DESACTIVADO]
    assert len(desactivados) == 1
    assert desactivados[0].resultado == 'exito'


def test_segundo_factor_superado_queda_auditado(client):
    _registrar(client)
    secret, _ = _activar_mfa(client)
    client.post('/auth/logout')

    login = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': PASSWORD})
    mfa_token = login.json()['mfa_token']
    res = client.post('/auth/login/mfa', json={'mfa_token': mfa_token, 'code': pyotp.TOTP(secret).now()})
    assert res.status_code == 200

    eventos = _eventos(client)
    superados = [e for e in eventos if e.evento == audit.EVENTO_MFA_SUPERADO]
    assert len(superados) == 1
    assert superados[0].resultado == 'exito'
    assert superados[0].user_id is not None
    assert superados[0].company_id is not None


def test_segundo_factor_rechazado_queda_auditado(client):
    _registrar(client)
    secret, _ = _activar_mfa(client)
    client.post('/auth/logout')

    login = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': PASSWORD})
    mfa_token = login.json()['mfa_token']
    res = client.post('/auth/login/mfa', json={'mfa_token': mfa_token, 'code': '000000'})
    assert res.status_code == 401

    eventos = _eventos(client)
    rechazados = [e for e in eventos if e.evento == audit.EVENTO_MFA_RECHAZADO]
    assert len(rechazados) == 1
    assert rechazados[0].resultado == 'fallo'
    assert rechazados[0].user_id is not None


def test_segundo_factor_rechazado_con_token_invalido_tambien_se_audita(client):
    _registrar(client)
    _activar_mfa(client)

    res = client.post('/auth/login/mfa', json={'mfa_token': 'no-es-un-token', 'code': '123456'})
    assert res.status_code == 401

    eventos = _eventos(client)
    rechazados = [e for e in eventos if e.evento == audit.EVENTO_MFA_RECHAZADO]
    assert len(rechazados) == 1
    # No hay claims que leer de un token que ni siquiera decodifica.
    assert rechazados[0].user_id is None


def test_cierre_de_sesion_queda_auditado(client):
    _registrar(client)

    res = client.post('/auth/logout')
    assert res.status_code == 204

    eventos = _eventos(client)
    cierres = [e for e in eventos if e.evento == audit.EVENTO_CIERRE_SESION]
    assert len(cierres) == 1
    assert cierres[0].user_id is not None


def test_logout_sin_cookie_no_registra_evento(client):
    res = client.post('/auth/logout')
    assert res.status_code == 204

    eventos = _eventos(client)
    assert len(eventos) == 0


def test_ningun_evento_de_auditoria_filtra_datos_sensibles(client):
    """Recorre TODA la bitácora generada por un flujo completo de MFA y
    verifica que ni la contraseña, ni el secreto TOTP, ni los códigos de
    respaldo aparecen en ningún `detalle`."""
    _registrar(client)
    secret, backup_codes = _activar_mfa(client)
    client.post('/auth/mfa/disable', json={'password': PASSWORD})
    client.post('/auth/logout')
    client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': PASSWORD})
    client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': 'mala-a-proposito'})

    eventos = _eventos(client)
    assert len(eventos) >= 5

    texto_completo = json.dumps([e.detalle for e in eventos])
    assert PASSWORD not in texto_completo
    assert 'mala-a-proposito' not in texto_completo
    assert secret not in texto_completo
    for codigo in backup_codes:
        assert codigo not in texto_completo


def test_cadena_de_hashes_del_flujo_completo_es_integra(client):
    _registrar(client)
    _activar_mfa(client)
    client.post('/auth/mfa/disable', json={'password': PASSWORD})
    client.post('/auth/logout')
    client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': PASSWORD})

    Session = sessionmaker(bind=client.db_engine)
    db = Session()
    try:
        resultado = audit.verificar_cadena(db)
    finally:
        db.close()

    assert resultado.intacta is True
    assert resultado.eventos_revisados >= 5
