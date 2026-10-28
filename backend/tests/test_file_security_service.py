from services.file_security_service import MAX_FILE_SIZE_BYTES, check_file_security, sanitize_filename

PDF_HEADER = bytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])  # %PDF-1.4
ZIP_HEADER = bytes([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])  # docx/xlsx
OLE_HEADER = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])  # doc/xls
EXE_HEADER = bytes([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])  # MZ (Windows PE)


def test_acepta_pdf_real():
    result = check_file_security('doc.pdf', 1024, PDF_HEADER)
    assert result.accepted is True


def test_acepta_docx_real():
    result = check_file_security('doc.docx', 1024, ZIP_HEADER)
    assert result.accepted is True


def test_acepta_doc_legado_real():
    result = check_file_security('doc.doc', 1024, OLE_HEADER)
    assert result.accepted is True


def test_rechaza_ejecutable_disfrazado_de_pdf():
    result = check_file_security('doc.pdf', 1024, EXE_HEADER)
    assert result.accepted is False
    assert 'ejecutable' in result.reason


def test_rechaza_extension_peligrosa():
    result = check_file_security('script.exe', 1024, EXE_HEADER)
    assert result.accepted is False


def test_rechaza_extension_no_soportada():
    result = check_file_security('imagen.png', 1024, bytes(8))
    assert result.accepted is False


def test_rechaza_archivo_vacio():
    result = check_file_security('doc.pdf', 0, b'')
    assert result.accepted is False


def test_rechaza_archivo_que_supera_el_limite():
    result = check_file_security('doc.pdf', MAX_FILE_SIZE_BYTES + 1, PDF_HEADER)
    assert result.accepted is False


def test_rechaza_doble_extension_peligrosa():
    result = check_file_security('documento.pdf.exe', 1024, PDF_HEADER)
    assert result.accepted is False


def test_rechaza_txt_que_en_realidad_es_binario():
    result = check_file_security('notas.txt', 1024, PDF_HEADER)
    assert result.accepted is False


def test_sanitize_filename_quita_rutas_y_caracteres_de_control():
    assert sanitize_filename('../../etc/passwd.pdf') == 'passwd.pdf'
    assert sanitize_filename('C:\\Users\\a\\archivo.pdf') == 'archivo.pdf'
    assert sanitize_filename('report"; filename="evil.bat') == 'report filename=evil.bat'
    assert sanitize_filename("doc'test;name.pdf\r\n") == 'doctestname.pdf'
