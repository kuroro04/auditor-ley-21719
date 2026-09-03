import services.quarantine_service as qs
from services.quarantine_service import move_to_clean, secure_delete, write_to_quarantine


def test_write_to_quarantine_crea_archivo_en_carpeta_de_la_empresa(tmp_path, monkeypatch):
    monkeypatch.setattr(qs, 'QUARANTINE_DIR', tmp_path / 'quarantine')

    ruta = write_to_quarantine('empresa-1', 'doc.pdf', b'contenido')

    assert ruta.exists()
    assert ruta.read_bytes() == b'contenido'
    assert ruta.parent.name == 'empresa-1'


def test_move_to_clean_traslada_archivo_a_storage_definitivo(tmp_path, monkeypatch):
    monkeypatch.setattr(qs, 'QUARANTINE_DIR', tmp_path / 'quarantine')
    monkeypatch.setattr(qs, 'STORAGE_DIR', tmp_path / 'storage')
    origen = write_to_quarantine('empresa-1', 'doc.pdf', b'contenido')

    destino = move_to_clean(origen, 'empresa-1')

    assert not origen.exists()
    assert destino.exists()
    assert destino.read_bytes() == b'contenido'
    assert destino.parent == tmp_path / 'storage' / 'empresa-1'


def test_secure_delete_elimina_el_archivo(tmp_path):
    archivo = tmp_path / 'infectado.txt'
    archivo.write_bytes(b'contenido malicioso')

    secure_delete(archivo)

    assert not archivo.exists()


def test_secure_delete_no_falla_si_el_archivo_no_existe(tmp_path):
    archivo = tmp_path / 'no_existe.txt'
    secure_delete(archivo)  # no debe lanzar excepción
