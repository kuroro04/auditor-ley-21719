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
