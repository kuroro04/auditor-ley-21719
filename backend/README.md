# DataShield API (backend)

Backend FastAPI de la Fase 2: registro/login de empresas y recepción de
documentos, con sesión en cookie httpOnly y aislamiento por `company_id`.
Almacenamiento en SQLite (`backend.db`) — se migrará a PostgreSQL en la
Fase 3 cambiando solo `DATABASE_URL`.

## Levantar el backend

```bash
cd backend
python -m venv venv

# Windows (PowerShell)
venv\Scripts\Activate.ps1
# Bash / git-bash
source venv/Scripts/activate

pip install -r requirements.txt
cp .env.example .env   # ajustar SECRET_KEY antes de ir a producción

uvicorn main:app --reload --port 8000
```

La API queda disponible en `http://localhost:8000` (docs interactivas en
`http://localhost:8000/docs`).

## Carga segura de documentos (Fase 4): ClamAV + cuarentena

Antes de aceptar cualquier archivo, `POST /documents/upload` lo pasa por
un pipeline de cuarentena:

```
archivo subido
      │
      ▼
1. se guarda en quarantine/<empresa>/   (zona temporal, separada de storage/)
      │
      ▼
2. validación MIME + magic bytes        (services/file_security_service.py)
      │  falla → se borra de forma segura, 400
      ▼
3. escaneo con ClamAV real (clamd)      (INSTREAM: se envían los bytes por
      │                                  socket, sin compartir filesystem)
      │  ClamAV no responde → se trata como infectado (fail-closed)
      │  infectado → se borra de forma segura, 400
      ▼
4. limpio → se mueve a storage/<empresa>/   (almacenamiento definitivo)
```

Cada intento de escaneo (limpio / infectado / error) queda registrado en
`backend/logs/document_scans.log` (una línea JSON por intento).

### Levantar ClamAV con Docker

```bash
docker compose up -d clamav      # desde la raíz del repo
docker compose logs -f clamav    # la primera vez demora unos minutos
                                  # (freshclam descarga las firmas de virus)
docker compose ps                # debe decir "healthy" antes de subir archivos
```

El backend se conecta a `clamd` por `CLAMAV_HOST`/`CLAMAV_PORT` (en
`backend/.env`, por defecto `localhost:3310`). **Fail-closed:** si ClamAV
no está corriendo o no responde, ningún archivo se acepta — nunca se
guarda un archivo sin haber sido escaneado.

Para detener ClamAV: `docker compose down` (los datos de firmas quedan en
un volumen Docker, así que no hay que re-descargarlas la próxima vez).

### Probar con el archivo de prueba EICAR

EICAR es el string estándar de la industria para probar antivirus — no es
un virus real, pero todo antivirus lo detecta como si lo fuera. Con
ClamAV corriendo:

```bash
python -m pytest tests/test_clamav_integration.py -v   # habla con ClamAV real
```

Este test se salta solo (no falla) si ClamAV no está levantado.

## Correr los tests

```bash
cd backend
python -m pytest -v
```

El resto de la suite (incluido `POST /documents/upload`) usa un cliente
ClamAV *falso* inyectado por dependencia — no depende de Docker corriendo,
pero simula clamd de verdad: detecta el string EICAR y declara limpio
cualquier otro contenido.

## Endpoints

| Método | Ruta               | Auth | Descripción                                      |
|--------|--------------------|------|---------------------------------------------------|
| POST   | `/auth/register`   | No   | Registra empresa + primer usuario (admin). 409 si el RUT ya existe. |
| POST   | `/auth/login`      | No   | Inicia sesión, setea cookie `access_token`.        |
| GET    | `/auth/me`         | Sí   | Datos del usuario autenticado.                     |
| POST   | `/auth/logout`     | Sí   | Cierra sesión (borra la cookie).                   |
| POST   | `/documents/upload`| Sí   | Sube un documento (`file` + `req_id`, multipart).  |
| GET    | `/documents`       | Sí   | Lista los documentos de la empresa de la sesión (no se audita: solo metadatos). |
| GET    | `/documents/{id}/download` | Sí | Descarga un documento. Audita `documento_consultado` (fail-closed). |
| DELETE | `/documents/{id}`  | Sí (admin) | Elimina un documento. Audita `documento_eliminado` (fail-closed). |
| POST   | `/audit/client-events` | Sí | Aviso del frontend: `diagnostico_ejecutado` o `exportacion_resultados`. **No verificable**, ver abajo. |

## Bitácora de auditoría (Fase 6)

<!--
LIMITACIÓN EXPLÍCITA — eventos reportados por el cliente.
El diagnóstico y la exportación del PDF corren en el navegador, no en el
servidor. Los eventos `diagnostico_ejecutado` y `exportacion_resultados` se
registran solo si el frontend llama a POST /audit/client-events: un cliente
modificado puede ejecutar ambas operaciones sin avisar, o avisar sin
ejecutarlas. Esos registros NO constituyen trazabilidad verificable.
Quedan marcados con detalle.origen = 'reportado_por_cliente' para no
confundirlos con los eventos que el servidor sí observa. Cerrar esta brecha
exige mover el diagnóstico y la exportación al backend.
-->

- **Observados por el servidor** (verificables): subida, rechazo por
  antivirus, descarga y eliminación de documentos, más los de autenticación.
- **Reportados por el cliente** (no verificables): diagnóstico ejecutado y
  exportación de resultados. Ver la limitación en `routers/client_events.py`.

### Verificar la integridad de la cadena de hashes

Cada evento de `audit_log` guarda el hash del anterior, así que alterar o
reordenar una fila antigua rompe la cadena desde ese punto.
`verificar_auditoria.py` recorre la bitácora, recalcula los hashes e informa
el primer evento inconsistente.

```powershell
# PowerShell, desde backend/
$env:AUDIT_VERIFIER_DATABASE_URL = "postgresql://audit_verifier:<password>@<host>:5432/postgres"
python verificar_auditoria.py                  # informe legible
python verificar_auditoria.py --desde-id 5000  # desde un punto (se enlaza con el evento anterior)
python verificar_auditoria.py --json           # salida JSON, para guardar o procesar
```

| Código de salida | Significado |
|------------------|-------------|
| 0 | Cadena íntegra |
| 1 | Cadena rota: el informe da el id del primer evento inconsistente y el motivo |
| 2 | No se pudo verificar (falta la variable, conexión fallida, rol incorrecto) |

En una tarea programada, cualquier código distinto de 0 debe generar una
alerta. La verificación se detiene en la primera inconsistencia: los eventos
posteriores a ella no se revisan.

**Por qué usa el rol `audit_verifier` y no `app_user`.** La cadena es
global: el evento N se encadena al N-1, sea de la empresa que sea. Para
verificarla hay que leer todas las filas de todos los tenants, y `app_user`
no puede hacerlo porque su política RLS solo le muestra los eventos del
tenant activo. Con ese rol la cadena vista tendría huecos (falsas rupturas)
o terminaría antes del último evento real, y se daría por íntegra sin
haberlo revisado. Darle a `app_user` una vía para ver todo (una función
`SECURITY DEFINER`, por ejemplo) abriría la bitácora de todas las empresas
al proceso que atiende a cada una de ellas. Por eso existe un rol aparte
(`db/rls_policies.sql` #7) que tiene `SELECT` sobre `audit_log`, una
política RLS propia que ve todos los tenants y nada más: no puede insertar,
modificar ni borrar. El script exige que la sesión sea efectivamente
`audit_verifier` (con otro rol, aunque sea `postgres`, no corre) y abre una
transacción de solo lectura `REPEATABLE READ`, así que verifica una foto
consistente aunque la aplicación siga escribiendo.

**Por qué la URL no va en `backend/.env`.** Ese archivo lo carga el backend
web. Si la credencial del verificador estuviera ahí, quedaría al alcance del
mismo proceso del que se quiere aislar, y la separación de roles no serviría
de nada. Se pasa solo como variable de entorno del proceso que corre la
verificación, guardada en el gestor de secretos del programador de tareas.
Si el script la encuentra en `backend/.env`, se niega a correr. La
contraseña del rol se fija con `AUDIT_VERIFIER_PASSWORD` al ejecutar
`db/setup_rls.py`.

### Copia externa en Better Stack

Cada evento que se confirma en `audit_log` también se envía a Better Stack
(`services/audit_externo.py`), para tener una copia fuera del alcance de
quien administre la base. Se activa con dos variables en `backend/.env`:

```
BETTERSTACK_SOURCE_TOKEN=<token de la source HTTP>
BETTERSTACK_INGEST_HOST=<host de ingesta, p. ej. s1234.eu-nbg-2.betterstackdata.com>
```

Si falta alguna de las dos, el envío queda desactivado y la aplicación
funciona igual. En los tests siempre está desactivado.

Se envían exactamente las columnas de `audit_log` (más `dt`, una copia de
`ocurrido_en`), incluidos `hash_previo` y `hash_evento`. Con ellos, la copia
externa se puede contrastar con la local evento por evento. No sale nada
que no esté ya en la bitácora local.

**Cómo funciona.** Solo se envían eventos de transacciones que hicieron
commit; lo que se deshace con un rollback no sale. El request del usuario
solo deja el evento en una cola en memoria (hasta 10.000 eventos). Un hilo
aparte la vacía en lotes por HTTP, con un timeout de 5 s y hasta 3 intentos.

**Limitación: el envío es best-effort.** Un evento puede quedar en
`audit_log` y no en Better Stack si el servicio externo falla más allá de
los reintentos, si la cola se llena durante una caída prolongada o si el
proceso termina con eventos en cola (al apagarse intenta vaciarla, con un
tope de tiempo). Cada pérdida queda registrada en el log de la aplicación,
con el `id` y el `hash_evento` de los eventos afectados. La base local
sigue siendo la fuente de verdad, y `verificar_auditoria.py` la verifica
de forma independiente.

### Limpieza de archivos huérfanos

Borra archivos de `storage/` sin un `Document` que los referencie (subida
interrumpida entre el traslado y el commit, o borrado de disco fallido tras
eliminar un documento). Solo toca archivos con más de 15 minutos de
antigüedad, para no pisar una subida en curso.

```bash
cd backend
python -m services.storage_cleanup --dry-run   # solo lista
python -m services.storage_cleanup             # borra
```

Debe correr en la misma máquina/volumen que `storage/` y con las mismas
variables de entorno que el backend. En producción: una tarea programada
(cron, timer de systemd o CronJob de Kubernetes), por ejemplo cada hora.
Devuelve código de salida 1 si algún archivo no se pudo borrar.

## Notas de seguridad

- Contraseñas: hasheadas con bcrypt, nunca en texto plano.
- Sesión: JWT en cookie `httpOnly` + `SameSite=Lax` — el frontend nunca lee
  el token directamente, así un XSS no puede robarlo.
- CSRF: no implementado en esta fase (queda documentado como pendiente para
  una fase posterior; `SameSite=Lax` ya mitiga el caso más común).
- Los archivos subidos se validan por extensión Y por firma binaria (magic
  bytes) antes de guardarse — ver `services/file_security_service.py`.
- Fase 4: además se escanean con ClamAV real antes de llegar al
  almacenamiento definitivo (fail-closed) — ver "Carga segura de
  documentos" más arriba.
