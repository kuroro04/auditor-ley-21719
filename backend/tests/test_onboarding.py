def _registrar_y_loguear(client, email='admin@empresatest.cl', rut='11.111.111-1'):
    client.post('/auth/register', json={
        'rut': rut,
        'nombre_empresa': 'Empresa Test',
        'email': email,
        'password': 'Clave-Segura123!',
        'sector': 'tecnologia',
    })
    client.post('/auth/login', json={'email': email, 'password': 'Clave-Segura123!'})


def test_usuario_nuevo_no_tiene_onboarding_completado(client):
    res = client.post('/auth/register', json={
        'rut': '11.111.111-1',
        'nombre_empresa': 'Empresa Test',
        'email': 'admin@empresatest.cl',
        'password': 'Clave-Segura123!',
        'sector': 'tecnologia',
    })
    assert res.json()['onboarding_completed'] is False


def test_completar_onboarding_sin_sesion_devuelve_401(client):
    res = client.post('/auth/complete-onboarding')
    assert res.status_code == 401


def test_completar_onboarding_marca_el_flag_y_persiste_entre_requests(client):
    _registrar_y_loguear(client)

    res = client.post('/auth/complete-onboarding')
    assert res.status_code == 204

    # Debe persistir: una petición posterior (simula un futuro login/sesión)
    # ya no debe pedir que se muestre el tour automáticamente.
    me = client.get('/auth/me')
    assert me.json()['onboarding_completed'] is True


def test_completar_onboarding_no_afecta_a_otro_usuario(client):
    _registrar_y_loguear(client, email='admin@empresatest.cl', rut='11.111.111-1')
    client.post('/auth/complete-onboarding')
    client.post('/auth/logout')

    _registrar_y_loguear(client, email='otra@empresatest.cl', rut='22.222.222-2')
    me = client.get('/auth/me')
    # Cada usuario tiene su propia preferencia; la de uno no debe filtrarse al otro.
    assert me.json()['onboarding_completed'] is False
