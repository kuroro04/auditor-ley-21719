import io
import re
import zipfile
from dataclasses import dataclass
from typing import Optional

# Espejo en Python de lib/fileSecurity.ts — mismas extensiones permitidas,
# extensiones peligrosas, firmas binarias y límite de tamaño, para que el
# backend rechace exactamente lo mismo que ya rechaza el cliente.

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_OOXML_UNCOMPRESSED_BYTES = 100 * 1024 * 1024  # 100 MB límite total de descompresión
MAX_OOXML_FILES_COUNT = 1000  # Máximo de archivos dentro del paquete OpenXML
MAX_OOXML_COMPRESSION_RATIO = 50  # Máxima relación de compresión para evitar zip bombs

DANGEROUS_EXTENSIONS = {
    'exe', 'js', 'mjs', 'cjs', 'bat', 'cmd', 'sh', 'msi', 'msc', 'scr',
    'vbs', 'vbe', 'ps1', 'psm1', 'jar', 'com', 'pif', 'gadget', 'hta',
    'wsf', 'wsh', 'lnk', 'reg', 'apk', 'dmg', 'app', 'dll', 'sys', 'jse',
}

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx'}

SIGNATURES = {
    'pdf': bytes([0x25, 0x50, 0x44, 0x46]),
    'zip': bytes([0x50, 0x4b, 0x03, 0x04]),
    'ole2': bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    'exe_pe': bytes([0x4d, 0x5a]),
    'elf': bytes([0x7f, 0x45, 0x4c, 0x46]),
}


# Tipo MIME que corresponde a cada extensión permitida. Solo es "detectado"
# (y no solo declarado por el cliente) después de que check_file_security
# aceptó el archivo, porque ahí ya se comprobó que los magic bytes coinciden
# con la extensión.
MIME_POR_EXTENSION = {
    'txt': 'text/plain',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}


@dataclass
class FileSecurityResult:
    accepted: bool
    reason: str


def _matches_signature(header: bytes, signature: bytes) -> bool:
    return len(header) >= len(signature) and header[: len(signature)] == signature


def sanitize_filename(name: str) -> str:
    base = re.split(r'[\\/]', name)[-1]
    sin_control = re.sub(r'[\x00-\x1f\x7f]', '', base)
    sin_peligrosos = re.sub(r'["\';\r\n]', '', sin_control)
    cleaned = re.sub(r'\s+', ' ', sin_peligrosos).strip()
    return cleaned or 'archivo'


def _get_extension(name: str) -> str:
    parts = name.rsplit('.', 1)
    return parts[-1].lower() if len(parts) > 1 else ''


def detected_mime(filename: str) -> str:
    """MIME de un archivo YA aceptado por check_file_security."""
    return MIME_POR_EXTENSION.get(_get_extension(filename), 'application/octet-stream')


def _has_dangerous_double_extension(name: str) -> bool:
    parts = name.lower().split('.')
    if len(parts) < 3:
        return False
    return any(p in DANGEROUS_EXTENSIONS for p in parts[1:-1])


def validate_ooxml_structure(content: bytes, ext: str) -> FileSecurityResult:
    """Inspección profunda de paquetes OpenXML (DOCX / XLSX) — Hallazgo DS-05.

    Verifica que:
    1. Sea un archivo ZIP válido.
    2. No contenga secuencias de escape de ruta (directory traversal).
    3. No supere los umbrales seguros de descompresión (defensa anti Zip-Bomb).
    4. Contenga la estructura mínima obligatoria de Open Packaging Conventions:
       - [Content_Types].xml
       - word/document.xml (para docx) o xl/workbook.xml (para xlsx).
    """
    try:
        buffer = io.BytesIO(content)
        if not zipfile.is_zipfile(buffer):
            return FileSecurityResult(False, f'El archivo .{ext} no es un archivo ZIP / OpenXML válido')

        with zipfile.ZipFile(buffer, 'r') as zf:
            infolist = zf.infolist()
            if len(infolist) > MAX_OOXML_FILES_COUNT:
                return FileSecurityResult(False, f'El archivo .{ext} contiene demasiadas entradas ({len(infolist)})')

            total_uncompressed = 0
            names = set()

            for info in infolist:
                # 1. Sanitización de rutas internas
                if '..' in info.filename or info.filename.startswith('/') or info.filename.startswith('\\') or '\x00' in info.filename:
                    return FileSecurityResult(False, f'El archivo .{ext} contiene rutas internas no permitidas (path traversal)')

                total_uncompressed += info.file_size
                names.add(info.filename)

            # 2. Protección contra Zip-Bomb
            if total_uncompressed > MAX_OOXML_UNCOMPRESSED_BYTES:
                return FileSecurityResult(False, f'El tamaño descomprimido del archivo .{ext} supera el límite de seguridad (100 MB)')

            ratio = total_uncompressed / max(1, len(content))
            if len(content) > 1024 and ratio > MAX_OOXML_COMPRESSION_RATIO:
                return FileSecurityResult(False, f'Relación de compresión anómala detectada ({ratio:.1f}x) — potencial zip bomb')

            # 3. Validación de estructura OpenXML
            if '[Content_Types].xml' not in names:
                return FileSecurityResult(False, f'El archivo .{ext} carece del descriptor obligatorio [Content_Types].xml')

            if ext == 'docx':
                has_doc = any(n.startswith('word/document') and n.endswith('.xml') for n in names)
                if not has_doc:
                    return FileSecurityResult(False, 'El archivo .docx carece de la parte principal (word/document.xml)')

            if ext == 'xlsx':
                has_sheet = any(n.startswith('xl/workbook') and n.endswith('.xml') for n in names)
                if not has_sheet:
                    return FileSecurityResult(False, 'El archivo .xlsx carece del libro principal (xl/workbook.xml)')

    except (zipfile.BadZipFile, zipfile.LargeZipFile, Exception) as e:
        return FileSecurityResult(False, f'Error al inspeccionar estructura OpenXML: {e}')

    return FileSecurityResult(True, 'Estructura OpenXML válida')


def check_file_security(
    filename: str,
    size: int,
    header: bytes,
    full_content: Optional[bytes] = None,
) -> FileSecurityResult:
    ext = _get_extension(filename)

    if size == 0:
        return FileSecurityResult(False, 'El archivo está vacío')
    if size > MAX_FILE_SIZE_BYTES:
        return FileSecurityResult(False, 'El archivo supera el límite de 50 MB')
    if ext in DANGEROUS_EXTENSIONS:
        return FileSecurityResult(False, f'Extensión peligrosa no permitida (.{ext})')
    if ext not in ALLOWED_EXTENSIONS:
        return FileSecurityResult(False, f"Tipo de archivo no soportado (.{ext or 'sin extensión'})")
    if _has_dangerous_double_extension(filename):
        return FileSecurityResult(False, 'Nombre de archivo con doble extensión sospechosa')

    if _matches_signature(header, SIGNATURES['exe_pe']) or _matches_signature(header, SIGNATURES['elf']):
        return FileSecurityResult(False, 'El contenido del archivo corresponde a un ejecutable, no a un documento')

    if ext == 'pdf' and not _matches_signature(header, SIGNATURES['pdf']):
        return FileSecurityResult(False, 'El contenido del archivo no coincide con un PDF válido')
    if ext in ('docx', 'xlsx'):
        if not _matches_signature(header, SIGNATURES['zip']):
            return FileSecurityResult(False, 'El contenido del archivo no coincide con un documento Office válido')
        if full_content is not None:
            ooxml_res = validate_ooxml_structure(full_content, ext)
            if not ooxml_res.accepted:
                return ooxml_res

    if ext in ('doc', 'xls') and not _matches_signature(header, SIGNATURES['ole2']):
        return FileSecurityResult(False, 'El contenido del archivo no coincide con un documento Office (formato antiguo) válido')
    if ext == 'txt':
        is_binary_disguised = (
            _matches_signature(header, SIGNATURES['pdf'])
            or _matches_signature(header, SIGNATURES['zip'])
            or _matches_signature(header, SIGNATURES['ole2'])
        )
        if is_binary_disguised:
            return FileSecurityResult(False, 'El archivo .txt en realidad contiene un formato binario')

    return FileSecurityResult(True, 'Archivo aceptado — validación de tipo y contenido correcta')
