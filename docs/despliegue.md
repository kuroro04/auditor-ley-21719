# Guía de despliegue — DataShield

> **Estado:** preparación previa al servidor completada (22-oct-2026).
> Los puntos marcados con `[PENDIENTE SÁBADO]` se completan cuando se
> conozca el tipo de servidor.

---

## 1. Requisitos del servidor

| Recurso | Mínimo recomendado | Notas |
|---|---|---|
| RAM | **2 GB** | El backend Python + ClamAV consumen ~800 MB en reposo; el frontend compilado es estático. Con 1 GB el servidor puede quedarse sin memoria durante el primer arranque de ClamAV (descarga de firmas). |
| CPU | 1 vCPU | Suficiente para uso académico. |
| Disco | 4 GB libres | ~1 GB sistema + ~1,5 GB firmas ClamAV + almacenamiento de documentos subidos. |
| Python | **3.11** | La versión exacta del entorno de desarrollo. |
| Node.js | **18 LTS o superior** | Para compilar y arrancar el frontend Next.js. |
| Docker | Recomendado | Simplifica ClamAV. Sin Docker hay que instalar y configurar `clamav`/`clamd` manualmente (ver §4). |
| HTTPS | **Obligatorio en producción** | Sin TLS la cookie de sesión (`httpOnly`, `Secure`) nunca llega al navegador. Además, los navegadores modernos bloquean `credentials: 'include'` en orígenes mixtos HTTP/HTTPS. Sin HTTPS la aplicación queda rota para los usuarios. |

### ¿Qué pasa si el servidor no tiene X?

- **Sin 2 GB RAM:** ClamAV puede fallar en el arranque inicial (OOM). Solución: deshabilitar ClamAV temporalmente poniendo `CLAMAV_HOST` apuntando a un host que no existe; la app funciona pero sin escaneo antivirus.
- **Sin Docker:** Instalar `clamav` desde el gestor de paquetes del SO y arrancar `clamd` manualmente. Ver §4.
- **Sin HTTPS:** La app no puede usarse con autenticación real. Opciones: Let's Encrypt + Nginx (gratuito), Cloudflare Tunnel, o pedir al profesor que exponga el dominio con TLS.
- **Sin acceso SSH:** [PENDIENTE SÁBADO] — si solo hay panel de hosting, el procedimiento de despliegue cambia.

---

## 2. Variables de entorno a configurar

### Backend (`backend/.env`)

Copiar `backend/.env.example` y rellenar:

```bash
# Obligatorias en producción:
SECRET_KEY=<clave larga y aleatoria>
MFA_ENC_KEY=<clave Fernet>
DATABASE_URL=<cadena de conexión PostgreSQL o ruta SQLite>
FRONTEND_ORIGIN=https://tudominio.cl      # dominio real, sin / al final
COOKIE_SECURE=true                        # obligatorio con HTTPS
TRUST_PROXY=true                          # si hay Nginx u otro proxy delante
                                          # false si la app queda expuesta directo

# ClamAV:
CLAMAV_HOST=localhost
CLAMAV_PORT=3310

# Better Stack (opcional):
BETTERSTACK_SOURCE_TOKEN=<token>
BETTERSTACK_INGEST_HOST=<host>
```

Generar `SECRET_KEY`:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Generar `MFA_ENC_KEY`:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Frontend (`.env.local` en la raíz del proyecto)

Copiar `.env.example` y rellenar:

```bash
NEXT_PUBLIC_API_URL=https://api.tudominio.cl   # URL pública del backend
```

---

## 3. Orden de arranque de servicios

### 3.1 ClamAV (primero)

```bash
docker compose up -d clamav
# Esperar a que esté "healthy" (~3 min la primera vez, descarga firmas):
docker compose ps
docker compose logs -f clamav
```

### 3.2 Backend FastAPI

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Linux/Mac
# .\venv\Scripts\activate         # Windows
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

> [PENDIENTE SÁBADO] Decidir si usar `uvicorn` directo, `gunicorn` con workers
> Uvicorn, o un servicio systemd. Con Docker: agregar un servicio `backend` al
> `docker-compose.yml`.

### 3.3 Modelo de embeddings (una sola vez por servidor)

El modelo no viaja en el repositorio. Hay que descargarlo explícitamente:

```bash
# Desde la raíz del proyecto (donde está package.json):
npm run fetch-model
```

El script descarga ~25 MB desde Hugging Face y verifica la integridad SHA-256
de cada archivo. Si hay error de integridad, aborta y no instala nada. Si no
hay conexión, la app arranca con el motor de reglas solo (sin análisis semántico)
y el script puede correrse más tarde.

### 3.4 Frontend Next.js

```bash
# Desde la raíz del proyecto:
npm install          # también corre postinstall → fetch-model (ver §3.3)
npm run build
npm start            # escucha en el puerto 3000 por defecto
```

> [PENDIENTE SÁBADO] Decidir si exponer Next.js directo o detrás de Nginx.
> Con Nginx se recomienda `next start -p 3000` y configurar Nginx como proxy.

---

## 4. ClamAV sin Docker

[PENDIENTE SÁBADO — solo si el servidor no tiene Docker]

```bash
# Ubuntu/Debian:
sudo apt-get update && sudo apt-get install -y clamav clamav-daemon
sudo freshclam                  # descarga firmas (requiere internet)
sudo systemctl start clamav-daemon
sudo systemctl enable clamav-daemon
```

El puerto por defecto de `clamd` es 3310, igual que `CLAMAV_PORT` en el `.env`.

---

## 5. Nginx como proxy inverso

[PENDIENTE SÁBADO — solo con VPS y acceso SSH]

Configuración mínima de Nginx para servir frontend en el dominio raíz y el
backend bajo `/api` (o en un subdominio separado `api.tudominio.cl`):

```nginx
server {
    listen 443 ssl;
    server_name tudominio.cl;

    # Certificado TLS (Let's Encrypt con certbot)
    ssl_certificate     /etc/letsencrypt/live/tudominio.cl/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.cl/privkey.pem;

    # Frontend Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name api.tudominio.cl;

    ssl_certificate     /etc/letsencrypt/live/api.tudominio.cl/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.tudominio.cl/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Con esta configuración: `TRUST_PROXY=true`, `FRONTEND_ORIGIN=https://tudominio.cl`,
`NEXT_PUBLIC_API_URL=https://api.tudominio.cl`.

---

## 6. Verificación post-despliegue

```bash
# 1. El backend responde:
curl https://api.tudominio.cl/health
# → {"status":"ok"}

# 2. CORS correcto (reemplaza el Origin por el tuyo):
curl -I -X OPTIONS https://api.tudominio.cl/health \
  -H "Origin: https://tudominio.cl" \
  -H "Access-Control-Request-Method: POST"
# → Access-Control-Allow-Origin: https://tudominio.cl

# 3. ClamAV sano:
docker compose ps   # debe decir "healthy" en la columna STATUS

# 4. Frontend carga y el login funciona:
# Abrir https://tudominio.cl en el navegador y registrar un usuario de prueba.

# 5. La cookie de sesión es Secure y HttpOnly:
# En DevTools → Application → Cookies: la cookie "access_token" debe tener
# los flags Secure y HttpOnly marcados.

# 6. El análisis semántico funciona:
# Subir un documento de política de privacidad y verificar que el diagnóstico
# muestra "Análisis semántico activo" (no "solo motor de reglas").
```

---

## 7. Archivos y datos que NO viajan en el repositorio

| Qué | Por qué | Qué hacer en el servidor |
|---|---|---|
| `backend/.env` | Contiene secretos reales | Crear manualmente con los valores de producción |
| `.env.local` (raíz) | Variables públicas del frontend | Crear con `NEXT_PUBLIC_API_URL` correcto |
| `public/models/` | Modelo de embeddings (~25 MB) | `npm run fetch-model` (o `npm install`) |
| `backend/storage/` | Documentos subidos por usuarios | Persiste en el servidor; hacer backup regularmente |
| `backend/backend.db` | Base de datos SQLite (si aplica) | En producción con PostgreSQL no existe |

---

## 8. Comandos de referencia rápida

```bash
# Iniciar todo (con Docker para ClamAV):
docker compose up -d clamav
cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 &
cd .. && npm start &

# Ver logs del backend:
# (ajustar según cómo se lanzó uvicorn — systemd, screen, etc.)

# Reiniciar ClamAV:
docker compose restart clamav

# Actualizar el código:
git pull
cd backend && pip install -r requirements.txt
cd .. && npm run build && npm start
```
