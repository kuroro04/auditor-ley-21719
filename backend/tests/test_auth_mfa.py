"""Pruebas de endpoint del segundo factor TOTP opcional (Fase 5).

Cubren enrolamiento, activación, login en dos pasos, códigos de respaldo
y desactivación — además de verificar que el login de un usuario SIN MFA
no cambia en nada.
"""
import pyotp
import pytest

PASSWORD = 'Clave-Segura123!'


def _registrar(client, email='admin@empresatest.cl', rut='11.111.111-1'):
    return client.post('/auth/register', json={
        'rut': rut,
        'nombre_empresa': 'Empresa Test',
        'email': email,
        'password': PASSWORD,
        'sector': 'tecnologia',
    })


def _activar_mfa(client):
    """Enrola y activa MFA para el usuario con sesión activa. Devuelve (secret, backup_codes)."""
    setup = client.post('/auth/mfa/setup')
    assert setup.status_code == 200
    secret = setup.json()['secret_base32']
    codigo = pyotp.TOTP(secret).now()
    activate = client.post('/auth/mfa/activate', json={'code': codigo})
    assert activate.status_code == 200
    return secret, activate.json()['backup_codes']


# --- Enrolamiento -----------------------------------------------------------

def test_setup_requiere_sesion(client):
    res = client.post('/auth/mfa/setup')
    assert res.status_code == 401


def test_setup_devuelve_qr_secreto_y_uri(client):
    _registrar(client)
    res = client.post('/auth/mfa/setup')
    assert res.status_code == 200
    body = res.json()
    assert body['secret_base32']
    assert body['otpauth_uri'].startswith('otpauth://totp/')
    assert body['qr_svg'].startswith('data:image/svg+xml;base64,')


def test_setup_no_activa_mfa_por_si_solo(client):
    _registrar(client)
    client.post('/auth/mfa/setup')
    # Todavía no confirmó con un código: el login debe seguir siendo de un solo paso.
    me = client.get('/auth/me')
    assert me.json()['mfa_enabled'] is False


def test_setup_falla_si_mfa_ya_esta_activo(client):
    _registrar(client)
    _activar_mfa(client)
    res = client.post('/auth/mfa/setup')
    assert res.status_code == 409


# --- Activación ------------------------------------------------------------

def test_activate_con_codigo_correcto_activa_mfa_y_entrega_codigos_de_respaldo(client):
    _registrar(client)
    _, backup_codes = _activar_mfa(client)
    assert len(backup_codes) == 10
    assert len(set(backup_codes)) == 10
    assert client.get('/auth/me').json()['mfa_enabled'] is True


def test_activate_con_codigo_incorrecto_no_activa(client):
    _registrar(client)
    client.post('/auth/mfa/setup')
    res = client.post('/auth/mfa/activate', json={'code': '000000'})
    assert res.status_code == 400
    assert client.get('/auth/me').json()['mfa_enabled'] is False


def test_activate_sin_setup_previo_devuelve_400(client):
    _registrar(client)
    res = client.post('/auth/mfa/activate', json={'code': '123456'})
    assert res.status_code == 400


def test_secreto_totp_nunca_viaja_en_las_respuestas_tras_activar(client):
    _registrar(client)
    secret, _ = _activar_mfa(client)
    assert secret not in client.get('/auth/me').text


# --- Login en dos pasos ---------------------------------------------------

def test_login_sin_mfa_sigue_funcionando_igual(client):
    _registrar(client)
    res = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': PASSWORD})
    assert res.status_code == 200
    assert 'access_token' in res.cookies
    assert res.json()['mfa_enabled'] is False


def test_login_con_mfa_no_entrega_cookie_y_pide_codigo(client):
    _registrar(client)
    _activar_mfa(client)
    client.post('/auth/logout')

    res = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': PASSWORD})
    assert res.status_code == 200
    body = res.json()
    assert body['mfa_required'] is True
    assert body['mfa_token']
    # No debe haberse iniciado sesión todavía.
    assert 'access_token' not in res.cookies
    assert client.get('/auth/me').status_code == 401


def test_login_con_mfa_password_incorrecta_devuelve_401_generico(client):
    _registrar(client)
    _activar_mfa(client)
    client.post('/auth/logout')
    res = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': 'mala'})
    assert res.status_code == 401


def test_segundo_paso_con_codigo_totp_valido_entrega_la_sesion(client):
    _registrar(client)
    secret, _ = _activar_mfa(client)
    client.post('/auth/logout')

    login = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': PASSWORD})
    mfa_token = login.json()['mfa_token']

    res = client.post('/auth/login/mfa', json={
        'mfa_token': mfa_token, 'code': pyotp.TOTP(secret).now(),
    })
    assert res.status_code == 200
    assert 'access_token' in res.cookies
    assert res.json()['email'] == 'admin@empresatest.cl'
    assert client.get('/auth/me').status_code == 200


def test_segundo_paso_con_codigo_invalido_devuelve_401_sin_sesion(client):
    _registrar(client)
    _activar_mfa(client)
    client.post('/auth/logout')
    login = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': PASSWORD})
    mfa_token = login.json()['mfa_token']

    res = client.post('/auth/login/mfa', json={'mfa_token': mfa_token, 'code': '000000'})
    assert res.status_code == 401
    assert 'access_token' not in res.cookies


def test_segundo_paso_con_mfa_token_falso_devuelve_401(client):
    _registrar(client)
    _activar_mfa(client)
    res = client.post('/auth/login/mfa', json={'mfa_token': 'no-es-un-token', 'code': '123456'})
    assert res.status_code == 401


def test_codigo_de_respaldo_sirve_una_sola_vez_en_el_segundo_paso(client):
    _registrar(client)
    _, backup_codes = _activar_mfa(client)
    client.post('/auth/logout')

    def login_paso1():
        return client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': PASSWORD}).json()['mfa_token']

    primero = client.post('/auth/login/mfa', json={'mfa_token': login_paso1(), 'code': backup_codes[0]})
    assert primero.status_code == 200
    client.post('/auth/logout')

    # El mismo código de respaldo ya no debe funcionar.
    segundo = client.post('/auth/login/mfa', json={'mfa_token': login_paso1(), 'code': backup_codes[0]})
    assert segundo.status_code == 401


# --- Desactivación ------------------------------------------------------------

def test_disable_con_password_correcta_desactiva_mfa(client):
    _registrar(client)
    _activar_mfa(client)
    res = client.post('/auth/mfa/disable', json={'password': PASSWORD})
    assert res.status_code == 204
    assert client.get('/auth/me').json()['mfa_enabled'] is False
    # Y el login vuelve a ser de un solo paso.
    client.post('/auth/logout')
    login = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': PASSWORD})
    assert 'access_token' in login.cookies


def test_disable_con_codigo_totp_valido_desactiva_mfa(client):
    _registrar(client)
    secret, _ = _activar_mfa(client)
    res = client.post('/auth/mfa/disable', json={'code': pyotp.TOTP(secret).now()})
    assert res.status_code == 204
    assert client.get('/auth/me').json()['mfa_enabled'] is False


def test_disable_sin_confirmacion_valida_devuelve_400_y_deja_mfa_activo(client):
    _registrar(client)
    _activar_mfa(client)
    res = client.post('/auth/mfa/disable', json={'password': 'mala'})
    assert res.status_code == 400
    assert client.get('/auth/me').json()['mfa_enabled'] is True


def test_disable_requiere_sesion(client):
    res = client.post('/auth/mfa/disable', json={'password': PASSWORD})
    assert res.status_code == 401
