import io
import os
import time
from datetime import timedelta

from sqlalchemy.orm import sessionmaker

from services.storage_cleanup import limpiar_archivos_huerfanos

PDF_BYTES = b'%PDF-1.4\n%mock pdf content for tests\n'
UNA_HORA = 3600


def _envejecer(path, segundos):
    antes = time.time() - segundos
    os.utime(path, (antes, antes))


def _registrar_y_subir(client):
    res = client.post('/auth/register', json={
        'rut': '11.111.111-1', 'nombre_empresa': 'Empresa Test', 'email': 'admin@a.cl',
        'password': 'Clave-Segura123!', 'sector': 'tecnologia',
    })
    client.post(
        '/documents/upload',
        data={'req_id': 'politica_privacidad'},
        files={'file': ('politica.pdf', io.BytesIO(PDF_BYTES), 'application/pdf')},
    )
    return res.json()['company_id']


def _limpiar(client, **kwargs):
    db = sessionmaker(bind=client.db_engine)()
    try:
        return limpiar_archivos_huerfanos(db, **kwargs)
    finally:
        db.close()


def _huerfano(tmp_path, company_id, nombre='huerfano.pdf', edad=UNA_HORA):
    carpeta = tmp_path / 'storage' / company_id
    carpeta.mkdir(parents=True, exist_ok=True)
    archivo = carpeta / nombre
    archivo.write_bytes(PDF_BYTES)
    _envejecer(archivo, edad)
    return archivo


def test_borra_archivo_sin_document_y_conserva_los_referenciados(client, tmp_path):
    company_id = _registrar_y_subir(client)
    [legitimo] = list((tmp_path / 'storage' / company_id).iterdir())
    _envejecer(legitimo, UNA_HORA)
    huerfano = _huerfano(tmp_path, company_id)

    resultado = _limpiar(client)

    assert resultado.borrados == [huerfano]
    assert not huerfano.exists()
    assert legitimo.exists()


def test_no_borra_archivos_recientes_de_una_subida_en_curso(client, tmp_path):
    company_id = _registrar_y_subir(client)
    reciente = _huerfano(tmp_path, company_id, edad=0)

    resultado = _limpiar(client, antiguedad_minima=timedelta(minutes=15))

    assert resultado.omitidos_recientes == [reciente]
    assert resultado.borrados == []
    assert reciente.exists()


def test_dry_run_no_borra_nada(client, tmp_path):
    company_id = _registrar_y_subir(client)
    huerfano = _huerfano(tmp_path, company_id)

    resultado = _limpiar(client, dry_run=True)

    assert resultado.borrados == [huerfano]
    assert huerfano.exists()


def test_archivo_de_otra_empresa_con_mismo_nombre_no_cuenta_como_referenciado(client, tmp_path):
    # Los Document de la empresa A no "protegen" archivos en la carpeta de B.
    company_a = _registrar_y_subir(client)
    [legitimo_a] = list((tmp_path / 'storage' / company_a).iterdir())
    _envejecer(legitimo_a, UNA_HORA)
    copia_en_b = _huerfano(tmp_path, 'empresa-b', nombre=legitimo_a.name)

    resultado = _limpiar(client)

    assert resultado.borrados == [copia_en_b]
    assert legitimo_a.exists()


def test_recoge_el_archivo_que_dejo_una_eliminacion_con_fallo_de_disco(client, tmp_path, monkeypatch):
    company_id = _registrar_y_subir(client)
    doc_id = client.get('/documents').json()[0]['id']
    [archivo] = list((tmp_path / 'storage' / company_id).iterdir())

    def _borrado_que_falla(_path):
        raise OSError('disco no disponible (prueba)')

    with monkeypatch.context() as m:
        m.setattr('routers.documents.secure_delete', _borrado_que_falla)
        assert client.delete(f'/documents/{doc_id}').status_code == 204
    assert archivo.exists()
    _envejecer(archivo, UNA_HORA)

    resultado = _limpiar(client)

    assert resultado.borrados == [archivo]
    assert not archivo.exists()


def test_sin_carpeta_de_storage_no_falla(client):
    resultado = _limpiar(client)
    assert resultado.borrados == []
