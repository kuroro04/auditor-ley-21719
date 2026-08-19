def test_registro_exitoso_crea_admin_y_setea_cookie(client):
    res = client.post('/auth/register', json={
        'rut': '11.111.111-1',
        'nombre_empresa': 'Empresa Test',
        'email': 'admin@empresatest.cl',
        'password': 'Clave-Segura123!',
        'sector': 'tecnologia',
    })
    assert res.status_code == 201
    body = res.json()
    assert body['role'] == 'administrador'
    assert body['company_nombre'] == 'Empresa Test'
    assert body['company_sector'] == 'tecnologia'
    assert body['email'] == 'admin@empresatest.cl'
    assert 'access_token' in res.cookies


def test_registro_con_rut_invalido_devuelve_400(client):
    res = client.post('/auth/register', json={
        'rut': '11.111.111-2',  # dígito verificador incorrecto
        'nombre_empresa': 'Empresa Test',
        'email': 'admin@empresatest.cl',
        'password': 'Clave-Segura123!',
    })
    assert res.status_code == 400


def test_registrar_rut_ya_existente_devuelve_409_y_no_crea_segundo_admin(client):
    payload = {
        'rut': '11.111.111-1',
        'nombre_empresa': 'Empresa Test',
        'email': 'admin@empresatest.cl',
        'password': 'Clave-Segura123!',
    }
    primero = client.post('/auth/register', json=payload)
    assert primero.status_code == 201

    segundo = client.post('/auth/register', json={**payload, 'email': 'otro@empresatest.cl'})
    assert segundo.status_code == 409
    assert 'ya está registrada' in segundo.json()['detail']


def test_registrar_email_ya_existente_devuelve_409(client):
    payload = {
        'rut': '11.111.111-1',
        'nombre_empresa': 'Empresa Test',
        'email': 'admin@empresatest.cl',
        'password': 'Clave-Segura123!',
    }
    client.post('/auth/register', json=payload)

    res = client.post('/auth/register', json={**payload, 'rut': '22.222.222-2'})
    assert res.status_code == 409
