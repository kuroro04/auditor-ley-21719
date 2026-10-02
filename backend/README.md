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
