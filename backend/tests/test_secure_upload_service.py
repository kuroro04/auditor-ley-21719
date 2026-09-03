import clamd as clamd_lib

import services.quarantine_service as qs
from services.secure_upload_service import process_secure_upload

PDF_BYTES = b'%PDF-1.4\n%mock pdf content for tests\n'


class _ClienteFalsoLimpio:
    llamado = False

    def instream(self, buffer):
        type(self).llamado = True
        return {'stream': ('OK', None)}


class _ClienteFalsoInfectado:
    def instream(self, buffer):
        return {'stream': ('FOUND', 'Eicar-Test-Signature')}


class _ClienteFalsoCaido:
    def instream(self, buffer):
        raise clamd_lib.ConnectionError('ClamAV no disponible (prueba)')


def _preparar_carpetas(tmp_path, monkeypatch):
    monkeypatch.setattr(qs, 'QUARANTINE_DIR', tmp_path / 'quarantine')
    monkeypatch.setattr(qs, 'STORAGE_DIR', tmp_path / 'storage')


def test_archivo_limpio_termina_en_storage_y_no_en_cuarentena(tmp_path, monkeypatch):
    _preparar_carpetas(tmp_path, monkeypatch)

    outcome = process_secure_upload('empresa-1', 'politica.pdf', PDF_BYTES, _ClienteFalsoLimpio())

    assert outcome.accepted
    assert outcome.stored_path.exists()
    assert outcome.stored_path.read_bytes() == PDF_BYTES
    assert not (tmp_path / 'quarantine' / 'empresa-1').exists() or list((tmp_path / 'quarantine' / 'empresa-1').iterdir()) == []


def test_archivo_eicar_es_rechazado_y_no_queda_en_disco(tmp_path, monkeypatch):
    _preparar_carpetas(tmp_path, monkeypatch)

    outcome = process_secure_upload('empresa-1', 'eicar.txt', clamd_lib.EICAR, _ClienteFalsoInfectado())

    assert not outcome.accepted
    assert 'amenaza' in outcome.reason.lower() or 'detectada' in outcome.reason.lower()
    assert not (tmp_path / 'storage' / 'empresa-1').exists()
    assert list((tmp_path / 'quarantine' / 'empresa-1').iterdir()) == []


def test_archivo_rechazado_por_validacion_no_llega_a_llamar_clamav(tmp_path, monkeypatch):
    _preparar_carpetas(tmp_path, monkeypatch)
    _ClienteFalsoLimpio.llamado = False

    outcome = process_secure_upload('empresa-1', 'falso.pdf', b'esto no es un pdf real', _ClienteFalsoLimpio())

    assert not outcome.accepted
    assert not _ClienteFalsoLimpio.llamado
    assert list((tmp_path / 'quarantine' / 'empresa-1').iterdir()) == []


def test_clamav_caido_rechaza_el_archivo_fail_closed(tmp_path, monkeypatch):
    _preparar_carpetas(tmp_path, monkeypatch)

    outcome = process_secure_upload('empresa-1', 'politica.pdf', PDF_BYTES, _ClienteFalsoCaido())

    assert not outcome.accepted
    assert not (tmp_path / 'storage' / 'empresa-1').exists()
    assert list((tmp_path / 'quarantine' / 'empresa-1').iterdir()) == []
