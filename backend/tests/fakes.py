"""Clientes ClamAV falsos para los tests — Fase 4.

Se comportan como clamd real para lo que nos importa: detectan el string
EICAR estándar (la firma de prueba universal de antivirus) y devuelven
OK para cualquier otro contenido. Así los tests de endpoint no dependen
de tener un contenedor de ClamAV corriendo.
"""
import clamd


class FakeClamdLimpio:
    """Simula clamd: detecta EICAR, declara limpio cualquier otro contenido."""

    def instream(self, buffer):
        contenido = buffer.read()
        if clamd.EICAR in contenido:
            return {'stream': ('FOUND', 'Eicar-Test-Signature')}
        return {'stream': ('OK', None)}


class FakeClamdCaido:
    """Simula un ClamAV inalcanzable (contenedor caído, timeout, etc.)."""

    def instream(self, buffer):
        raise clamd.ConnectionError('ClamAV no disponible (prueba)')
