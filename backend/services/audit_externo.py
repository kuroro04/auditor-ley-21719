"""Copia externa de la bitácora de auditoría en Better Stack (Fase 6).

audit_log es la fuente de verdad; esto es una copia redundante, fuera del
alcance de quien administre la base, para contrastarla después con la local
por id, hash_previo y hash_evento.

Diseño (best-effort, nunca bloquea al usuario):

- registrar_evento() no envía nada: arma el payload y lo deja pendiente en
  la sesión (session.info). Recién cuando la transacción hace COMMIT, un
  listener after_commit lo pasa a la cola. Así nunca sale un evento que
  después se deshizo con un rollback (sus hashes no existirían en la cadena
  local y la copia externa no cuadraría).
- La cola es en memoria y acotada (queue.Queue), y la consume un hilo
  daemon que manda lotes por HTTP. El request del usuario solo hace un
  put_nowait: si la cola está llena (Better Stack caído o lento durante
  mucho rato), el evento se descarta de la copia externa y se registra en el
  log de la aplicación; la memoria no crece sin límite.
- Cada POST tiene timeout corto y pocos reintentos con espera creciente. Si
  se agotan, el lote se descarta y se registra en el log de la aplicación
  (ids y hash_evento, nunca el detalle).

Limitación: un evento puede quedar en audit_log y no en Better Stack (envío
fallido, cola llena, proceso terminado con eventos en cola). Ver README.

Privacidad: el payload son exactamente las columnas de audit_log (más `dt`,
copia de ocurrido_en, que Better Stack usa como fecha del evento). Nada que
no esté ya en la bitácora local, que a su vez nunca guarda contenido de
documentos ni datos personales de terceros.
"""
import logging
import queue
import threading
from typing import Callable, Optional

import httpx
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

TAM_COLA_DEFAULT = 10_000
TAM_LOTE_DEFAULT = 100
TIMEOUT_SEGUNDOS_DEFAULT = 5.0
INTENTOS_DEFAULT = 3
ESPERA_BASE_SEGUNDOS_DEFAULT = 1.0

_CLAVE_PENDIENTES = 'audit_envio_externo_pendiente'
_FIN = object()


def payload_de_registro(registro, iso_utc: Callable) -> dict:
    """Las columnas de audit_log, tal cual. `dt` es ocurrido_en, para Better Stack."""
    ocurrido_en = iso_utc(registro.ocurrido_en)
    return {
        'dt': ocurrido_en,
        'id': registro.id,
        'ocurrido_en': ocurrido_en,
        'evento': registro.evento,
        'resultado': registro.resultado,
        'user_id': registro.user_id,
        'company_id': registro.company_id,
        'ip_origen': registro.ip_origen,
        'detalle': registro.detalle or {},
        'hash_previo': registro.hash_previo,
        'hash_evento': registro.hash_evento,
    }


def _url_ingesta(host: str) -> str:
    host = host.strip().rstrip('/')
    return host if host.startswith(('http://', 'https://')) else f'https://{host}'


class EnviadorBetterStack:
    def __init__(
        self,
        host: str,
        token: str,
        *,
        cliente_http: Optional[httpx.Client] = None,
        tam_cola: int = TAM_COLA_DEFAULT,
        tam_lote: int = TAM_LOTE_DEFAULT,
        timeout: float = TIMEOUT_SEGUNDOS_DEFAULT,
        intentos: int = INTENTOS_DEFAULT,
        espera_base: float = ESPERA_BASE_SEGUNDOS_DEFAULT,
    ):
        self._url = _url_ingesta(host)
        self._token = token
        self._cliente = cliente_http or httpx.Client(timeout=timeout)
        self._cola: queue.Queue = queue.Queue(maxsize=tam_cola)
        self._tam_lote = tam_lote
        self._intentos = intentos
        self._espera_base = espera_base
        self._deteniendo = threading.Event()
        self._hilo: Optional[threading.Thread] = None
        self._lock_hilo = threading.Lock()

    def encolar(self, payload: dict) -> None:
        """No bloquea ni lanza excepciones: lo llama el hilo del request."""
        try:
            self._asegurar_hilo()
            self._cola.put_nowait(payload)
        except queue.Full:
            logger.error(
                'Cola de envío a Better Stack llena: evento de auditoría id=%s hash_evento=%s '
                'no se copiará externamente (sigue en audit_log)',
                payload.get('id'), payload.get('hash_evento'),
            )
        except Exception:
            logger.exception('No se pudo encolar el evento de auditoría id=%s para Better Stack', payload.get('id'))

    def detener(self, timeout: float = 5.0) -> None:
        """Intenta vaciar la cola antes de salir (apagado ordenado), con tope de tiempo."""
        if self._hilo is None:
            return
        try:
            self._cola.put(_FIN, timeout=timeout)
        except queue.Full:
            pass
        self._hilo.join(timeout)
        # Lo que quede sin enviar tras el tope se pierde de la copia externa:
        # cortar los reintentos en curso para no demorar el apagado.
        self._deteniendo.set()
        self._hilo.join(timeout)
        pendientes = self._cola.qsize()
        if pendientes:
            logger.error('Apagado con %d eventos de auditoría sin copiar a Better Stack (siguen en audit_log)', pendientes)

    def _asegurar_hilo(self) -> None:
        # Arranque perezoso: no hay hilo si nunca se registra un evento.
        if self._hilo is not None:
            return
        with self._lock_hilo:
            if self._hilo is None:
                self._hilo = threading.Thread(target=self._bucle, name='audit-betterstack', daemon=True)
                self._hilo.start()

    def _bucle(self) -> None:
        terminar = False
        while not terminar:
            primero = self._cola.get()
            if primero is _FIN:
                break
            lote = [primero]
            while len(lote) < self._tam_lote:
                try:
                    siguiente = self._cola.get_nowait()
                except queue.Empty:
                    break
                if siguiente is _FIN:
                    terminar = True
                    break
                lote.append(siguiente)
            try:
                self._enviar_lote(lote)
            except Exception:
                # El hilo no debe morir nunca: si muere, todos los envíos
                # siguientes se pierden en silencio.
                logger.exception('Error inesperado enviando un lote de auditoría a Better Stack')

    def _enviar_lote(self, lote: list) -> None:
        cabeceras = {'Authorization': f'Bearer {self._token}', 'Content-Type': 'application/json'}
        motivo = ''
        for intento in range(1, self._intentos + 1):
            try:
                respuesta = self._cliente.post(self._url, json=lote, headers=cabeceras)
                if respuesta.is_success:
                    return
                motivo = f'HTTP {respuesta.status_code}'
                # 4xx (salvo 429) no se arregla reintentando: token o payload malos.
                if 400 <= respuesta.status_code < 500 and respuesta.status_code != 429:
                    break
            except httpx.HTTPError as exc:
                motivo = f'{exc.__class__.__name__}: {exc}'
            if intento < self._intentos and self._deteniendo.wait(self._espera_base * 2 ** (intento - 1)):
                break

        logger.error(
            'Fallo el envío a Better Stack de %d eventos de auditoría (%s). Siguen en audit_log; '
            'no quedan en la copia externa: %s',
            len(lote), motivo,
            ', '.join(f'id={p.get("id")} hash_evento={p.get("hash_evento")}' for p in lote),
        )


_enviador: Optional[EnviadorBetterStack] = None
_enviador_inicializado = False
_lock_enviador = threading.Lock()


def obtener_enviador() -> Optional[EnviadorBetterStack]:
    """El enviador configurado, o None si faltan las variables de Better Stack."""
    global _enviador, _enviador_inicializado
    if not _enviador_inicializado:
        with _lock_enviador:
            if not _enviador_inicializado:
                from core.config import BETTERSTACK_INGEST_HOST, BETTERSTACK_SOURCE_TOKEN

                if BETTERSTACK_SOURCE_TOKEN and BETTERSTACK_INGEST_HOST:
                    _enviador = EnviadorBetterStack(BETTERSTACK_INGEST_HOST, BETTERSTACK_SOURCE_TOKEN)
                _enviador_inicializado = True
    return _enviador


def configurar_enviador(enviador: Optional[EnviadorBetterStack]) -> None:
    """Reemplaza el enviador global (tests)."""
    global _enviador, _enviador_inicializado
    with _lock_enviador:
        _enviador = enviador
        _enviador_inicializado = True


def detener() -> None:
    if _enviador is not None:
        _enviador.detener()


def programar_envio(db: Session, registro, payload: dict) -> None:
    """Deja el evento pendiente de envío hasta que la transacción haga commit."""
    if obtener_enviador() is None:
        return
    db.info.setdefault(_CLAVE_PENDIENTES, []).append((registro, payload))


@event.listens_for(Session, 'after_commit')
def _despachar_tras_commit(session: Session) -> None:
    pendientes = session.info.pop(_CLAVE_PENDIENTES, None)
    enviador = obtener_enviador()
    if not pendientes or enviador is None:
        return
    for registro, payload in pendientes:
        # Un evento que se agregó dentro de un SAVEPOINT que después se
        # deshizo vuelve a quedar transient: no llegó a la base, no se envía.
        if inspect(registro).transient:
            continue
        enviador.encolar(payload)


@event.listens_for(Session, 'after_soft_rollback')
def _descartar_tras_rollback(session: Session, transaccion_previa) -> None:
    # Solo el rollback de la transacción completa descarta todo; el de un
    # SAVEPOINT se resuelve en after_commit (ver arriba).
    if transaccion_previa.parent is None:
        session.info.pop(_CLAVE_PENDIENTES, None)
