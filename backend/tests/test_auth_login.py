def _registrar(client, email='admin@empresatest.cl'):
    return client.post('/auth/register', json={
        'rut': '11.111.111-1',
        'nombre_empresa': 'Empresa Test',
        'email': email,
        'password': 'Clave-Segura123!',
        'sector': 'tecnologia',
    })


def test_login_con_credenciales_correctas_devuelve_sesion(client):
    _registrar(client)
    res = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': 'Clave-Segura123!'})
    assert res.status_code == 200
    body = res.json()
    assert body['role'] == 'administrador'
    assert body['company_nombre'] == 'Empresa Test'
    assert 'access_token' in res.cookies


def test_login_con_password_incorrecta_devuelve_401(client):
    _registrar(client)
    res = client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': 'incorrecta'})
    assert res.status_code == 401


def test_login_con_email_inexistente_devuelve_401(client):
    res = client.post('/auth/login', json={'email': 'nadie@empresatest.cl', 'password': 'lo-que-sea'})
    assert res.status_code == 401


def test_me_sin_cookie_devuelve_401(client):
    res = client.get('/auth/me')
    assert res.status_code == 401


def test_me_con_sesion_devuelve_datos_del_usuario(client):
    _registrar(client)
    client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': 'Clave-Segura123!'})
    res = client.get('/auth/me')
    assert res.status_code == 200
    assert res.json()['email'] == 'admin@empresatest.cl'


def test_logout_borra_la_cookie_de_sesion(client):
    _registrar(client)
    client.post('/auth/login', json={'email': 'admin@empresatest.cl', 'password': 'Clave-Segura123!'})
    res = client.post('/auth/logout')
    assert res.status_code == 204

    me_despues = client.get('/auth/me')
    assert me_despues.status_code == 401


def test_token_reutilizado_despues_de_logout_es_rechazado_por_el_servidor(client):
    # Hallazgo DS-02: Un token robado o reutilizado después de /logout debe ser
    # invalidado en el servidor aunque su firma criptográfica y tiempo exp sigan vigentes.
    _registrar(client, email='revocado@empresatest.cl')
    login_res = client.post('/auth/login', json={'email': 'revocado@empresatest.cl', 'password': 'Clave-Segura123!'})
    assert login_res.status_code == 200
    token_original = login_res.cookies['access_token']

    # Se ejecuta el cierre de sesión en servidor
    logout_res = client.post('/auth/logout')
    assert logout_res.status_code == 204

    # El atacante o cliente intenta reutilizar el token original forzando la cookie
    client.cookies.set('access_token', token_original)
    me_reintento = client.get('/auth/me')
    assert me_reintento.status_code == 401
    assert 'invalidada tras cierre de sesión' in me_reintento.json()['detail']
