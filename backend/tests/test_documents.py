import io


def _registrar_y_login(client, rut, email):
    client.post('/auth/register', json={
        'rut': rut, 'nombre_empresa': f'Empresa {rut}', 'email': email,
        'password': 'Clave-Segura123!', 'sector': 'tecnologia',
    })


PDF_BYTES = b'%PDF-1.4\n%mock pdf content for tests\n'


def test_subir_documento_valido(client):
    _registrar_y_login(client, '11.111.111-1', 'admin@a.cl')
    res = client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
    )
    assert res.status_code == 201
    body = res.json()
    assert body['req_id'] == 'politica_privacidad'
    assert body['filename'] == 'politica.pdf'
    assert body['size_bytes'] == len(PDF_BYTES)


def test_subir_documento_sin_sesion_devuelve_401(client):
    res = client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
    )
    assert res.status_code == 401


def test_subir_archivo_rechazado_por_magic_bytes_devuelve_400(client):
    _registrar_y_login(client, '11.111.111-1', 'admin@a.cl')
    res = client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('falso.pdf', io.BytesIO(b'esto no es un pdf real'), 'application/pdf')},
    )
    assert res.status_code == 400


def test_listar_documentos_de_la_propia_empresa(client):
    _registrar_y_login(client, '11.111.111-1', 'admin@a.cl')
    client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
    )
    res = client.get('/documents')
    assert res.status_code == 200
    docs = res.json()
    assert len(docs) == 1
    assert docs[0]['filename'] == 'politica.pdf'


def test_empresa_b_no_ve_documentos_de_empresa_a(client):
    _registrar_y_login(client, '11.111.111-1', 'admin@a.cl')
    client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
    )
    client.post('/auth/logout')

    _registrar_y_login(client, '22.222.222-2', 'admin@b.cl')
    res = client.get('/documents')
    assert res.status_code == 200
    assert res.json() == []
