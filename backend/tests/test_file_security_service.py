import io
import zipfile
from services.file_security_service import MAX_FILE_SIZE_BYTES, check_file_security, sanitize_filename, validate_ooxml_structure

PDF_HEADER = bytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])  # %PDF-1.4
ZIP_HEADER = bytes([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])  # docx/xlsx
OLE_HEADER = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])  # doc/xls
EXE_HEADER = bytes([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])  # MZ (Windows PE)


def _crear_zip_en_memoria(archivos: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        for nombre, data in archivos.items():
            zf.writestr(nombre, data)
    return buf.getvalue()


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


def test_ooxml_valido_docx():
    content = _crear_zip_en_memoria({
        '[Content_Types].xml': b'<Types/>',
        'word/document.xml': b'<w:document/>',
    })
    res = check_file_security('reporte.docx', len(content), content[:8], full_content=content)
    assert res.accepted is True


def test_ooxml_valido_xlsx():
    content = _crear_zip_en_memoria({
        '[Content_Types].xml': b'<Types/>',
        'xl/workbook.xml': b'<workbook/>',
    })
    res = check_file_security('planilla.xlsx', len(content), content[:8], full_content=content)
    assert res.accepted is True


def test_rechaza_zip_generico_disfrazado_de_docx():
    # Hallazgo DS-05: Un ZIP que no contiene [Content_Types].xml ni word/document.xml
    content = _crear_zip_en_memoria({
        'foto.jpg': b'datos-imagen-falsa',
        'script.py': b'print("hola")',
    })
    res = check_file_security('falso_contrato.docx', len(content), content[:8], full_content=content)
    assert res.accepted is False
    assert '[Content_Types].xml' in res.reason or 'OpenXML' in res.reason


def test_rechaza_ooxml_con_path_traversal():
    content = _crear_zip_en_memoria({
        '[Content_Types].xml': b'<Types/>',
        'word/../../etc/passwd': b'root:x:0:0',
        'word/document.xml': b'<w:document/>',
    })
    res = check_file_security('malicioso.docx', len(content), content[:8], full_content=content)
    assert res.accepted is False
    assert 'path traversal' in res.reason
