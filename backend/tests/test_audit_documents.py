"""Verifica que los endpoints de documentos (routers/documents.py) registran
los eventos de auditoría esperados, sin contenido del documento en
`detalle`, y que un fallo de auditoría en la subida (evento crítico,
fail-closed) deja sin efecto la operación tanto en base como en disco
(Fase 6).
"""
import hashlib
import io
import json

import clamd as clamd_lib
from sqlalchemy.orm import Session, sessionmaker

import core.deps as deps_module
import main as main_module
import services.quarantine_service as qs
from core.config import COOKIE_NAME
from core.deps import get_clamav_client
from core.security import create_access_token
from db.models import AuditLog, Document
from services import audit
from tests.fakes import FakeClamdCaido

# Contenido con un "dato personal" reconocible, para comprobar que nunca
# termina en la bitácora.
PDF_BYTES = b'%PDF-1.4\nRUT 12.345.678-5 Juan Perez - contenido confidencial\n'
SECRETO_EN_CONTENIDO = 'contenido confidencial'


def _bitacora_caida(*_args, **_kwargs):
    raise RuntimeError('bitácora no disponible (prueba)')


def _archivos_en(tmp_path, carpeta):
    base = tmp_path / carpeta
    return [p for p in base.rglob('*') if p.is_file()] if base.exists() else []


def _db(client):
    return sessionmaker(bind=client.db_engine)()


def _eventos(client, evento=None):
    db = _db(client)
    try:
        q = db.query(AuditLog).order_by(AuditLog.id)
        if evento:
            q = q.filter(AuditLog.evento == evento)
        return q.all()
    finally:
        db.close()


def _documentos(client):
    db = _db(client)
    try:
        return db.query(Document).all()
    finally:
        db.close()


def _registrar(client):
    res = client.post('/auth/register', json={
        'rut': '11.111.111-1', 'nombre_empresa': 'Empresa Test', 'email': 'admin@a.cl',
        'password': 'Clave-Segura123!', 'sector': 'tecnologia',
    })
    return res.json()['company_id']


def _subir(client, nombre='politica.pdf', contenido=PDF_BYTES, mime='application/pdf'):
    return client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': (nombre, io.BytesIO(contenido), mime)},
    )


# --- Documento subido -------------------------------------------------------

def test_subida_exitosa_registra_evento_con_metadatos(client, tmp_path):
    company_id = _registrar(client)

    res = _subir(client)
    assert res.status_code == 201

    eventos = _eventos(client, audit.EVENTO_DOCUMENTO_SUBIDO)
    assert len(eventos) == 1
    e = eventos[0]
    assert e.resultado == 'exito'
    assert e.company_id == company_id
    assert e.user_id is not None
    assert e.ip_origen is not None
    assert e.detalle == {
        'nombre_archivo': 'politica.pdf',
        'sha256': hashlib.sha256(PDF_BYTES).hexdigest(),
        'tamano_bytes': len(PDF_BYTES),
        'mime_detectado': 'application/pdf',
        'veredicto_escaneo': 'limpio',
        'document_id': res.json()['id'],
        'req_id': 'politica_privacidad',
    }
    # Y el archivo terminó en storage, no en cuarentena.
    assert len(_archivos_en(tmp_path, 'storage')) == 1
    assert _archivos_en(tmp_path, 'quarantine') == []


def test_con_trust_proxy_usa_x_forwarded_for_como_ip(client, monkeypatch):
    monkeypatch.setattr(deps_module, 'TRUST_PROXY', True)
    _registrar(client)
    client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
        headers={'X-Forwarded-For': '203.0.113.7, 10.0.0.1'},
    )
    assert _eventos(client, audit.EVENTO_DOCUMENTO_SUBIDO)[0].ip_origen == '203.0.113.7'


def test_sin_trust_proxy_ignora_x_forwarded_for_falso(client, monkeypatch):
    # Caso de seguridad: sin proxy de confianza, X-Forwarded-For enviado
    # por el cliente se ignora — no puede falsificarse la IP en la bitácora.
    monkeypatch.setattr(deps_module, 'TRUST_PROXY', False)
    _registrar(client)
    client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
        headers={'X-Forwarded-For': '203.0.113.7, 10.0.0.1'},
    )
    ip = _eventos(client, audit.EVENTO_DOCUMENTO_SUBIDO)[0].ip_origen
    assert ip != '203.0.113.7'


# --- Documento rechazado ----------------------------------------------------

def test_rechazo_por_firma_registra_motivo_y_firma(client, tmp_path):
    _registrar(client)

    res = _subir(client, 'eicar.txt', clamd_lib.EICAR, 'text/plain')
    assert res.status_code == 400

    eventos = _eventos(client, audit.EVENTO_DOCUMENTO_RECHAZADO_ANTIVIRUS)
    assert len(eventos) == 1
    e = eventos[0]
    assert e.resultado == 'rechazado'
    assert e.detalle['motivo'] == 'firma_detectada'
    assert e.detalle['firma'] == 'Eicar-Test-Signature'
    assert e.detalle['veredicto_escaneo'] == 'infectado'
    assert e.detalle['sha256'] == hashlib.sha256(clamd_lib.EICAR).hexdigest()
    assert clamd_lib.EICAR.decode() not in json.dumps(e.detalle)
    assert _eventos(client, audit.EVENTO_DOCUMENTO_SUBIDO) == []
    assert _documentos(client) == []
    assert _archivos_en(tmp_path, 'storage') == []


def test_rechazo_por_fallo_del_escaner_registra_motivo(client):
    _registrar(client)
    main_module.app.dependency_overrides[get_clamav_client] = lambda: FakeClamdCaido()

    res = _subir(client)
    assert res.status_code == 400

    e = _eventos(client, audit.EVENTO_DOCUMENTO_RECHAZADO_ANTIVIRUS)[0]
    assert e.detalle['motivo'] == 'fallo_escaner'
    assert e.detalle['veredicto_escaneo'] == 'error'
    assert e.detalle['firma'] is None
    assert SECRETO_EN_CONTENIDO not in json.dumps(e.detalle)


def test_rechazo_por_mime_invalido_registra_motivo_sin_escanear(client):
    _registrar(client)

    res = _subir(client, 'falso.pdf', b'esto no es un pdf real', 'application/pdf')
    assert res.status_code == 400

    e = _eventos(client, audit.EVENTO_DOCUMENTO_RECHAZADO_ANTIVIRUS)[0]
    assert e.detalle['motivo'] == 'validacion_tipo'
    assert e.detalle['veredicto_escaneo'] is None
    assert e.detalle['mime_declarado'] == 'application/pdf'
    assert 'esto no es un pdf real' not in json.dumps(e.detalle)


# --- Contenido fuera de la bitácora ----------------------------------------

def test_ningun_evento_de_documentos_incluye_contenido(client):
    _registrar(client)
    _subir(client)
    _subir(client, 'eicar.txt', clamd_lib.EICAR, 'text/plain')
    _subir(client, 'falso.pdf', b'%PDX ' + SECRETO_EN_CONTENIDO.encode(), 'application/pdf')

    texto = json.dumps([e.detalle for e in _eventos(client)], ensure_ascii=False)
    assert SECRETO_EN_CONTENIDO not in texto
    assert '12.345.678-5' not in texto
    assert 'Juan Perez' not in texto
    assert clamd_lib.EICAR.decode() not in texto


# --- Fail-closed ------------------------------------------------------------

def test_fallo_de_auditoria_en_subida_no_deja_documento_ni_archivo(client, tmp_path, monkeypatch):
    _registrar(client)
    eventos_antes = len(_eventos(client))

    monkeypatch.setattr(audit, '_ultimo_hash_global', _bitacora_caida)

    res = _subir(client)

    assert res.status_code == 503
    assert _documentos(client) == []
    assert len(_eventos(client)) == eventos_antes
    # El archivo nunca llegó a storage y no quedó abandonado en cuarentena.
    assert _archivos_en(tmp_path, 'storage') == []
    assert _archivos_en(tmp_path, 'quarantine') == []


def test_fallo_del_commit_tras_mover_el_archivo_lo_borra_de_storage(client, tmp_path, monkeypatch):
    """El caso que el rollback de base no cubre: el archivo YA se movió a
    almacenamiento definitivo y después falla el commit. La compensación
    del router debe borrarlo."""
    _registrar(client)
    eventos_antes = len(_eventos(client))

    movimientos = []
    move_original = qs.move_to_clean

    def _move_registrando(quarantine_path, company_id):
        destino = move_original(quarantine_path, company_id)
        movimientos.append(destino)
        return destino

    def _commit_que_falla(self):
        raise RuntimeError('commit falló (prueba)')

    with monkeypatch.context() as m:
        m.setattr('routers.documents.move_to_clean', _move_registrando)
        m.setattr(Session, 'commit', _commit_que_falla)
        res = _subir(client)

    assert res.status_code == 503
    assert len(movimientos) == 1, 'el archivo debió alcanzar a moverse antes del commit'
    assert not movimientos[0].exists()
    assert _archivos_en(tmp_path, 'storage') == []
    assert _documentos(client) == []
    assert len(_eventos(client)) == eventos_antes


def test_fallo_de_auditoria_en_rechazo_no_cambia_la_respuesta(client, monkeypatch):
    # documento_rechazado_antivirus no está en EVENTOS_CRITICOS (fail-open):
    # el archivo ya fue descartado, así que el usuario igual recibe el 400.
    _registrar(client)
    monkeypatch.setattr(audit, '_ultimo_hash_global', _bitacora_caida)

    res = _subir(client, 'eicar.txt', clamd_lib.EICAR, 'text/plain')

    assert res.status_code == 400


# --- Documento consultado (descarga) ----------------------------------------

def test_descarga_entrega_el_archivo_y_registra_consulta(client):
    company_id = _registrar(client)
    doc_id = _subir(client).json()['id']

    res = client.get(f'/documents/{doc_id}/download')

    assert res.status_code == 200
    assert res.content == PDF_BYTES
    eventos = _eventos(client, audit.EVENTO_DOCUMENTO_CONSULTADO)
    assert len(eventos) == 1
    e = eventos[0]
    assert e.resultado == 'exito'
    assert e.company_id == company_id
    assert e.detalle['document_id'] == doc_id
    assert e.detalle['nombre_archivo'] == 'politica.pdf'
    assert SECRETO_EN_CONTENIDO not in json.dumps(e.detalle)


def test_listado_no_se_audita_como_consulta(client):
    _registrar(client)
    _subir(client)
    client.get('/documents')
    assert _eventos(client, audit.EVENTO_DOCUMENTO_CONSULTADO) == []


def test_descarga_de_documento_inexistente_devuelve_404_sin_evento(client):
    _registrar(client)
    res = client.get('/documents/no-existe/download')
    assert res.status_code == 404
    assert _eventos(client, audit.EVENTO_DOCUMENTO_CONSULTADO) == []


def test_empresa_b_no_puede_descargar_documento_de_empresa_a(client):
    _registrar(client)
    doc_id = _subir(client).json()['id']
    client.post('/auth/logout')
    client.post('/auth/register', json={
        'rut': '22.222.222-2', 'nombre_empresa': 'Empresa B', 'email': 'admin@b.cl',
        'password': 'Clave-Segura123!', 'sector': 'tecnologia',
    })

    res = client.get(f'/documents/{doc_id}/download')

    assert res.status_code == 404
    assert _eventos(client, audit.EVENTO_DOCUMENTO_CONSULTADO) == []


def test_fallo_de_auditoria_en_descarga_no_entrega_el_archivo(client, monkeypatch):
    _registrar(client)
    doc_id = _subir(client).json()['id']
    monkeypatch.setattr(audit, '_ultimo_hash_global', _bitacora_caida)

    res = client.get(f'/documents/{doc_id}/download')

    assert res.status_code == 503
    assert PDF_BYTES not in res.content


# --- Documento eliminado ----------------------------------------------------

def test_eliminacion_borra_fila_y_archivo_y_registra_evento(client, tmp_path):
    _registrar(client)
    doc_id = _subir(client).json()['id']

    res = client.delete(f'/documents/{doc_id}')

    assert res.status_code == 204
    assert _documentos(client) == []
    assert _archivos_en(tmp_path, 'storage') == []
    eventos = _eventos(client, audit.EVENTO_DOCUMENTO_ELIMINADO)
    assert len(eventos) == 1
    assert eventos[0].resultado == 'exito'
    assert eventos[0].detalle['document_id'] == doc_id
    assert SECRETO_EN_CONTENIDO not in json.dumps(eventos[0].detalle)


def test_fallo_de_auditoria_en_eliminacion_conserva_fila_y_archivo(client, tmp_path, monkeypatch):
    _registrar(client)
    doc_id = _subir(client).json()['id']
    monkeypatch.setattr(audit, '_ultimo_hash_global', _bitacora_caida)

    res = client.delete(f'/documents/{doc_id}')

    assert res.status_code == 503
    assert [d.id for d in _documentos(client)] == [doc_id]
    assert len(_archivos_en(tmp_path, 'storage')) == 1
    assert _eventos(client, audit.EVENTO_DOCUMENTO_ELIMINADO) == []


def test_fallo_al_borrar_el_archivo_tras_el_commit_igual_elimina_el_documento(client, tmp_path, monkeypatch):
    # El documento queda eliminado y auditado; el archivo queda huérfano
    # para services/storage_cleanup.py.
    _registrar(client)
    doc_id = _subir(client).json()['id']

    def _borrado_que_falla(_path):
        raise OSError('disco no disponible (prueba)')

    monkeypatch.setattr('routers.documents.secure_delete', _borrado_que_falla)
    res = client.delete(f'/documents/{doc_id}')

    assert res.status_code == 204
    assert _documentos(client) == []
    assert len(_eventos(client, audit.EVENTO_DOCUMENTO_ELIMINADO)) == 1
    assert len(_archivos_en(tmp_path, 'storage')) == 1


def test_solo_el_administrador_puede_eliminar(client):
    company_id = _registrar(client)
    doc_id = _subir(client).json()['id']
    user_id = _eventos(client, audit.EVENTO_EMPRESA_REGISTRADA)[0].user_id
    client.cookies.set(COOKIE_NAME, create_access_token(user_id, company_id, 'auditor'))

    res = client.delete(f'/documents/{doc_id}')

    assert res.status_code == 403
    assert len(_documentos(client)) == 1
    assert _eventos(client, audit.EVENTO_DOCUMENTO_ELIMINADO) == []


# --- Cadena -----------------------------------------------------------------

def test_cadena_de_hashes_con_eventos_de_documentos_es_integra(client):
    _registrar(client)
    doc_id = _subir(client).json()['id']
    _subir(client, 'eicar.txt', clamd_lib.EICAR, 'text/plain')
    client.get(f'/documents/{doc_id}/download')
    client.delete(f'/documents/{doc_id}')

    db = _db(client)
    try:
        resultado = audit.verificar_cadena(db)
    finally:
        db.close()
    assert resultado.intacta is True
    assert resultado.eventos_revisados == 5
