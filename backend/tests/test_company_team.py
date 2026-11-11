import pytest
from core.config import COOKIE_NAME
from db.models import User

def _registrar(client, rut='11.111.111-1', email='admin@acme.cl', nombre='Acme SpA', sector='tecnologia'):
    return client.post('/auth/register', json={
        'rut': rut,
        'nombre_empresa': nombre,
        'email': email,
        'password': 'Clave-Segura123!',
        'sector': sector,
    })

def _db(client):
    from db.database import get_db
    from main import app
    return next(app.dependency_overrides[get_db]())

def test_get_company_profile(client):
    _registrar(client)
    res = client.get('/auth/company')
    assert res.status_code == 200
    data = res.json()
    assert data['nombre'] == 'Acme SpA'
    assert data['rut'] == '111111111'
    assert data['total_users'] == 1
    assert data['total_documents'] == 0

def test_update_company_profile(client):
    _registrar(client)
    res = client.put('/auth/company', json={
        'nombre': 'Acme Global SpA',
        'sector': 'finanzas',
    })
    assert res.status_code == 200
    data = res.json()
    assert data['nombre'] == 'Acme Global SpA'
    assert data['sector'] == 'finanzas'

def test_actualizar_empresa_sin_permiso_admin_da_403(client):
    _registrar(client)
    db = _db(client)
    user = db.query(User).filter(User.email == 'admin@acme.cl').first()
    user.role = 'auditor'
    db.commit()

    res = client.put('/auth/company', json={'nombre': 'Intento Fallido'})
    assert res.status_code == 403

def test_crear_y_listar_miembros_del_equipo(client):
    _registrar(client)
    
    # Listar inicialmente (1 usuario)
    res_list = client.get('/auth/users')
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1
    assert res_list.json()[0]['email'] == 'admin@acme.cl'

    # Admin crea nuevo usuario auditor
    res_create = client.post('/auth/users', json={
        'email': 'auditor@acme.cl',
        'password': 'Password-Auditor123!',
        'role': 'auditor',
    })
    assert res_create.status_code == 201
    assert res_create.json()['email'] == 'auditor@acme.cl'
    assert res_create.json()['role'] == 'auditor'

    # Listar nuevamente (2 usuarios)
    res_list2 = client.get('/auth/users')
    assert len(res_list2.json()) == 2

def test_modificar_rol_de_miembro(client):
    _registrar(client)
    res_create = client.post('/auth/users', json={
        'email': 'operador@acme.cl',
        'password': 'Password-Operador123!',
        'role': 'visualizador',
    })
    nuevo_id = res_create.json()['id']

    # Cambiar rol a auditor
    res_patch = client.patch(f'/auth/users/{nuevo_id}/role', json={'role': 'auditor'})
    assert res_patch.status_code == 200
    assert res_patch.json()['role'] == 'auditor'

def test_no_se_puede_auto_degradar_el_unico_administrador(client):
    _registrar(client)
    res_me = client.get('/auth/me')
    admin_id = _db(client).query(User).filter(User.email == 'admin@acme.cl').first().id

    res_demote = client.patch(f'/auth/users/{admin_id}/role', json={'role': 'visualizador'})
    assert res_demote.status_code == 400
    assert 'al menos un administrador' in res_demote.json()['detail']

def test_revocar_sesiones_en_otros_dispositivos(client):
    _registrar(client)
    res_revoke = client.post('/auth/revoke-sessions')
    assert res_revoke.status_code == 200
    assert res_revoke.json()['ok'] is True
    # /auth/me sigue funcionando con la nueva cookie emitida
    res_me = client.get('/auth/me')
    assert res_me.status_code == 200
