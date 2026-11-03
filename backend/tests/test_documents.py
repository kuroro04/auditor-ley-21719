import io

import clamd as clamd_lib

import main as main_module
from core.config import COOKIE_NAME
from core.deps import get_clamav_client
from core.security import create_access_token
from services.clamav_service import DETALLE_ESCANER_NO_DISPONIBLE
from tests.fakes import FakeClamdCaido


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
    # El frontend usa `codigo` para explicar al usuario qué pasó.
    assert res.json()['codigo'] == 'validacion_tipo'


def test_subir_archivo_eicar_es_detectado_y_rechazado(client):
    _registrar_y_login(client, '11.111.111-1', 'admin@a.cl')
    res = client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('eicar.txt', io.BytesIO(clamd_lib.EICAR), 'text/plain')},
    )
    assert res.status_code == 400
    assert 'amenaza' in res.json()['detail'].lower() or 'detectada' in res.json()['detail'].lower()
    assert res.json()['codigo'] == 'firma_detectada'


def test_subir_documento_con_clamav_no_disponible_no_se_acepta(client):
    _registrar_y_login(client, '11.111.111-1', 'admin@a.cl')
    main_module.app.dependency_overrides[get_clamav_client] = lambda: FakeClamdCaido()

    res = client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
    )

    assert res.status_code == 400
    assert res.json()['codigo'] == 'fallo_escaner'
    # La respuesta HTTP no revela qué antivirus se usa ni el error interno.
    assert res.json()['detail'] == DETALLE_ESCANER_NO_DISPONIBLE
    assert 'clamav' not in res.text.lower()
    assert 'no disponible (prueba)' not in res.text
    assert 'ConnectionError' not in res.text


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


def test_subir_documento_con_rol_no_admin_devuelve_403(client):
    token = create_access_token('user-1', 'comp-1', 'visualizador')
    client.cookies.set(COOKIE_NAME, token)
    res = client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
    )
    assert res.status_code == 403
    assert 'administrador' in res.json()['detail']
