import pytest
import jwt
from core.config import COOKIE_NAME, SECRET_KEY, ALGORITHM
from core.security import create_access_token
from db.models import User

def _registrar(client, rut='11.111.111-1', email='admin@testcorp.cl'):
    return client.post('/auth/register', json={
        'rut': rut,
        'nombre_empresa': 'Test Corp',
        'email': email,
        'password': 'Clave-Segura123!',
        'sector': 'tecnologia',
    })

def _db(client):
    from db.database import get_db
    from main import app
    return next(app.dependency_overrides[get_db]())

def test_usuario_inexistente_o_eliminado_devuelve_401(client):
    # A02: Token con user_id inventado debe retornar 401
    token = create_access_token('non-existent-user-uuid', 'comp-uuid', 'administrador', token_version=1)
    client.cookies.set(COOKIE_NAME, token)
    res = client.get('/auth/me')
    assert res.status_code == 401
    assert 'inexistente' in res.json()['detail'].lower()

def test_administrador_degradado_obtiene_rol_actualizado_inmediatamente(client):
    # A02: Si se degrada a visualizador en BD, la sesión activa recibe 403 al subir documentos
    _registrar(client)
    db = _db(client)
    user = db.query(User).filter(User.email == 'admin@testcorp.cl').first()
    assert user.role == 'administrador'
    
    # Degradar en BD
    user.role = 'visualizador'
    db.commit()

    # /auth/me debe reportar rol visualizador de inmediato
    res_me = client.get('/auth/me')
    assert res_me.status_code == 200
    assert res_me.json()['role'] == 'visualizador'

def test_token_legado_sin_version_es_rechazado(client):
    # A03: Tokens sin el claim 'ver' son rechazados
    _registrar(client)
    db = _db(client)
    user = db.query(User).filter(User.email == 'admin@testcorp.cl').first()
    
    token_sin_ver = jwt.encode(
        {'sub': user.id, 'company_id': user.company_id, 'role': 'administrador', 'exp': 9999999999},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    client.cookies.set(COOKIE_NAME, token_sin_ver)
    res = client.get('/auth/me')
    assert res.status_code == 401
    assert 'versión' in res.json()['detail'].lower()

def test_logout_con_token_viejo_no_invalida_sesion_nueva(client):
    # A03: Reutilizar un token revocado en logout no debe cerrar la sesión nueva del usuario
    reg = _registrar(client)
    token_v1 = reg.cookies[COOKIE_NAME]
    
    # Usuario hace logout formal -> sube versión a 2
    res_out = client.post('/auth/logout')
    assert res_out.status_code == 204
    
    # Usuario inicia sesión nuevamente -> obtiene token v2
    login_res = client.post('/auth/login', json={'email': 'admin@testcorp.cl', 'password': 'Clave-Segura123!'})
    assert login_res.status_code == 200
    token_v2 = login_res.cookies[COOKIE_NAME]
    
    # Atacante o dispositivo viejo envía token_v1 a logout
    client.cookies.set(COOKIE_NAME, token_v1)
    res_fake_out = client.post('/auth/logout')
    assert res_fake_out.status_code == 204
    
    # La sesión activa token_v2 NO debe haber sido invalidada
    client.cookies.set(COOKIE_NAME, token_v2)
    res_me = client.get('/auth/me')
    assert res_me.status_code == 200
    assert res_me.json()['email'] == 'admin@testcorp.cl'

def test_contrasena_unicode_mas_de_72_bytes_rechazada_con_422_sin_500(client):
    # A23: 40 caracteres con tilde son 80 bytes UTF-8; debe responder 422, nunca 500
    res = client.post('/auth/register', json={
        'rut': '22.222.222-2',
        'nombre_empresa': 'Unicode Test',
        'email': 'unicode@testcorp.cl',
        'password': 'á' * 40,
        'sector': 'tecnologia',
    })
    assert res.status_code == 422
    assert '72 bytes' in str(res.json())

def test_login_con_password_larga_no_provoca_error_500(client):
    # A23: Intento de login con clave que excede límite de bytes responde 401 (o 422), nunca 500
    res = client.post('/auth/login', json={
        'email': 'admin@testcorp.cl',
        'password': 'á' * 50,
    })
    assert res.status_code in (401, 422)
    assert res.status_code != 500
