import re
from dataclasses import dataclass

# Espejo en Python de lib/fileSecurity.ts — mismas extensiones permitidas,
# extensiones peligrosas, firmas binarias y límite de tamaño, para que el
# backend rechace exactamente lo mismo que ya rechaza el cliente.

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

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


@dataclass
class FileSecurityResult:
    accepted: bool
    reason: str


def _matches_signature(header: bytes, signature: bytes) -> bool:
    return len(header) >= len(signature) and header[: len(signature)] == signature


def sanitize_filename(name: str) -> str:
    base = re.split(r'[\\/]', name)[-1]
    sin_control = re.sub(r'[\x00-\x1f\x7f]', '', base)
    cleaned = re.sub(r'\s+', ' ', sin_control).strip()
    return cleaned or 'archivo'


def _get_extension(name: str) -> str:
    parts = name.rsplit('.', 1)
    return parts[-1].lower() if len(parts) > 1 else ''


def _has_dangerous_double_extension(name: str) -> bool:
    parts = name.lower().split('.')
    if len(parts) < 3:
        return False
    return any(p in DANGEROUS_EXTENSIONS for p in parts[1:-1])


def check_file_security(filename: str, size: int, header: bytes) -> FileSecurityResult:
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
    if ext in ('docx', 'xlsx') and not _matches_signature(header, SIGNATURES['zip']):
        return FileSecurityResult(False, 'El contenido del archivo no coincide con un documento Office válido')
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
