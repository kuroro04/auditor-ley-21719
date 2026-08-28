# DataShield — Ley 21.719

Plataforma de diagnóstico de cumplimiento de la Ley 21.719 (protección de
datos personales, Chile). El análisis de documentos (motor de reglas +
capa semántica) corre 100% en el navegador. Desde la Fase 2, el registro
de empresas, el login y la recepción de documentos los maneja un backend
real (FastAPI), ver `backend/README.md`.

## Levantar todo en desarrollo

Se necesitan dos procesos corriendo a la vez, en dos terminales distintas.

**Terminal 1 — backend (puerto 8000):**

```bash
cd backend
python -m venv venv
venv\Scripts\Activate.ps1   # PowerShell; en bash: source venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend (puerto 3000):**

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`. El frontend habla con el backend en
`http://localhost:8000` (configurable con `NEXT_PUBLIC_API_URL`).

## Tests

```bash
npm test                        # frontend (Vitest)
cd backend && python -m pytest  # backend (pytest)
```
