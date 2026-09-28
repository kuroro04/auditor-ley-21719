"""Bitácora de auditoría append-only con encadenamiento de hashes (Fase 6).

Cada evento guarda el hash SHA-256 del evento anterior (hash_previo) y su
propio hash (hash_evento), calculado sobre todos sus campos más ese
hash_previo. Alterar o borrar una fila antigua rompe la cadena a partir de
ese punto, y verificar_cadena() lo detecta.

En `detalle` nunca debe ir contenido de documentos ni datos personales de
terceros: solo metadatos (nombre de archivo, hash del archivo, veredicto).
"""
import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from db.models import AuditLog

logger = logging.getLogger(__name__)

# Hash "previo" del primer evento de la tabla: no hay ningún evento antes.
HASH_GENESIS = '0' * 64

# --- Catálogo de eventos ---------------------------------------------------
# Usar siempre estas constantes en vez de strings sueltos: evita typos que
# creen un evento nuevo por accidente y rompan filtros/búsquedas.
EVENTO_LOGIN_EXITOSO = 'login_exitoso'
EVENTO_LOGIN_FALLIDO = 'login_fallido'
EVENTO_MFA_SUPERADO = 'mfa_superado'
EVENTO_MFA_RECHAZADO = 'mfa_rechazado'
EVENTO_MFA_ACTIVADO = 'mfa_activado'
EVENTO_MFA_DESACTIVADO = 'mfa_desactivado'
EVENTO_CIERRE_SESION = 'cierre_sesion'
EVENTO_DOCUMENTO_SUBIDO = 'documento_subido'
EVENTO_DOCUMENTO_RECHAZADO_ANTIVIRUS = 'documento_rechazado_antivirus'
EVENTO_DOCUMENTO_CONSULTADO = 'documento_consultado'
EVENTO_DOCUMENTO_ELIMINADO = 'documento_eliminado'
EVENTO_DIAGNOSTICO_EJECUTADO = 'diagnostico_ejecutado'
EVENTO_EXPORTACION_RESULTADOS = 'exportacion_resultados'
EVENTO_EMPRESA_REGISTRADA = 'empresa_registrada'
EVENTO_CAMBIO_CONTRASENA = 'cambio_contrasena'
EVENTO_VERIFICACION_INTEGRIDAD_EJECUTADA = 'verificacion_integridad_ejecutada'

# Eventos de tratamiento de datos personales (y el cambio de contraseña, por
# su sensibilidad equivalente): si no se pueden auditar, la operación no debe
# ejecutarse (fail-closed). verificar_cadena() detecta alteraciones de filas
# existentes, pero no detecta un evento que nunca se escribió — una ausencia
# no deja hueco en la cadena — así que para estos eventos no basta con el
# control compensatorio y hace falta bloquear la operación misma.
#
# El resto (autenticación, MFA, cierre de sesión) es fail-open: un bug de
# auditoría no debe dejar a nadie fuera del sistema.
EVENTOS_CRITICOS = frozenset({
    EVENTO_DOCUMENTO_SUBIDO,
    EVENTO_DOCUMENTO_CONSULTADO,
    EVENTO_DOCUMENTO_ELIMINADO,
    EVENTO_EXPORTACION_RESULTADOS,
    EVENTO_CAMBIO_CONTRASENA,
})


def _campo_o_vacio(valor) -> str:
    """None se serializa como cadena vacía, nunca como el string 'None'."""
    return '' if valor is None else str(valor)


def _iso_utc(momento: datetime) -> str:
    """ISO 8601 en UTC, estable venga o no con tzinfo desde el driver.

    SQLite descarta la zona horaria al guardar un DateTime; sin esta
    normalización, verificar_cadena() fallaría por un artefacto de
    almacenamiento y no por una alteración real de los datos.
    """
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    else:
        momento = momento.astimezone(timezone.utc)
    return momento.isoformat()


def _detalle_canonico(detalle: Optional[dict]) -> str:
    return json.dumps(detalle or {}, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def _calcular_hash(
    *,
    evento: str,
    resultado: str,
    user_id,
    company_id,
    ip_origen,
    detalle,
    ocurrido_en: datetime,
    hash_previo: str,
) -> str:
    """Serialización canónica y determinista de un evento, para hashear."""
    cadena = '|'.join([
        evento,
        resultado,
        _campo_o_vacio(user_id),
        _campo_o_vacio(company_id),
        _campo_o_vacio(ip_origen),
        _detalle_canonico(detalle),
        _iso_utc(ocurrido_en),
        hash_previo,
    ])
    return hashlib.sha256(cadena.encode('utf-8')).hexdigest()


def registrar_evento(
    db: Session,
    evento: str,
    resultado: str,
    *,
    user_id: Optional[str] = None,
    company_id: Optional[str] = None,
    ip_origen: Optional[str] = None,
    detalle: Optional[dict] = None,
) -> Optional[AuditLog]:
    """Agrega un evento a la bitácora, encadenado por hash al anterior.

    No hace commit: la entrada de auditoría queda en la transacción de
    quien llama, para vivir o morir junto con la operación que audita.

    Si el registro falla:
    - eventos en EVENTOS_CRITICOS (tratamiento de datos personales, cambio
      de contraseña): se relanza la excepción, así la operación que llama
      no se ejecuta.
    - el resto (login, MFA, cierre de sesión): se registra en el log de la
      aplicación y se continúa, devolviendo None.
    """
    try:
        with db.begin_nested():
            if db.get_bind().dialect.name == 'postgresql':
                # Serializa la escritura de la cadena entre transacciones
                # concurrentes: sin este lock, dos requests podrían leer el
                # mismo "último hash_evento" y bifurcar la cadena.
                db.execute(text('LOCK TABLE audit_log IN EXCLUSIVE MODE'))

            ultimo = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
            hash_previo = ultimo.hash_evento if ultimo is not None else HASH_GENESIS

            ocurrido_en = datetime.now(timezone.utc)
            hash_evento = _calcular_hash(
                evento=evento,
                resultado=resultado,
                user_id=user_id,
                company_id=company_id,
                ip_origen=ip_origen,
                detalle=detalle,
                ocurrido_en=ocurrido_en,
                hash_previo=hash_previo,
            )

            registro = AuditLog(
                ocurrido_en=ocurrido_en,
                evento=evento,
                resultado=resultado,
                user_id=user_id,
                company_id=company_id,
                ip_origen=ip_origen,
                detalle=detalle or {},
                hash_previo=hash_previo,
                hash_evento=hash_evento,
            )
            db.add(registro)
            db.flush()
        return registro
    except Exception:
        logger.exception('No se pudo registrar el evento de auditoría "%s"', evento)
        if evento in EVENTOS_CRITICOS:
            raise
        return None


@dataclass
class ResultadoVerificacionCadena:
    intacta: bool
    eventos_revisados: int
    id_primera_inconsistencia: Optional[int] = None
    motivo: Optional[str] = None


def verificar_cadena(db: Session, desde_id: Optional[int] = None) -> ResultadoVerificacionCadena:
    """Recorre la bitácora en orden de id y valida el encadenamiento de hashes.

    Detecta alteraciones de filas existentes (el hash recalculado no
    coincide con el almacenado) y bifurcaciones o inserciones fuera de orden
    (hash_previo no coincide con el hash_evento de la fila anterior). No
    detecta eventos que nunca se escribieron: una ausencia no deja hueco en
    la cadena — por eso registrar_evento es fail-closed para los eventos
    críticos, en vez de depender solo de esta verificación posterior.
    """
    query = db.query(AuditLog).order_by(AuditLog.id.asc())
    if desde_id is not None:
        query = query.filter(AuditLog.id >= desde_id)

    hash_previo_esperado = HASH_GENESIS
    if desde_id is not None:
        anterior = (
            db.query(AuditLog)
            .filter(AuditLog.id < desde_id)
            .order_by(AuditLog.id.desc())
            .first()
        )
        if anterior is not None:
            hash_previo_esperado = anterior.hash_evento

    revisados = 0
    for fila in query:
        revisados += 1

        if fila.hash_previo != hash_previo_esperado:
            return ResultadoVerificacionCadena(
                intacta=False,
                eventos_revisados=revisados,
                id_primera_inconsistencia=fila.id,
                motivo='hash_previo no coincide con el hash_evento del registro anterior',
            )

        recalculado = _calcular_hash(
            evento=fila.evento,
            resultado=fila.resultado,
            user_id=fila.user_id,
            company_id=fila.company_id,
            ip_origen=fila.ip_origen,
            detalle=fila.detalle,
            ocurrido_en=fila.ocurrido_en,
            hash_previo=fila.hash_previo,
        )
        if recalculado != fila.hash_evento:
            return ResultadoVerificacionCadena(
                intacta=False,
                eventos_revisados=revisados,
                id_primera_inconsistencia=fila.id,
                motivo='hash_evento almacenado no coincide con el recalculado',
            )

        hash_previo_esperado = fila.hash_evento

    return ResultadoVerificacionCadena(intacta=True, eventos_revisados=revisados)
