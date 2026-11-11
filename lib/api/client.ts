// Cliente HTTP hacia el backend FastAPI (Fase 2). `credentials: 'include'`
// es obligatorio en cada llamada: es lo que hace que el navegador envíe la
// cookie httpOnly de sesión — el JS de esta app nunca la lee directamente,
// solo confía en que el navegador la reenvía automáticamente.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  // Código de motivo legible por máquina, cuando el backend lo envía
  // (ej. `codigo` en los rechazos de /documents/upload).
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    body: isFormData ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let detail = `Error ${res.status}`;
    let code: string | undefined;
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string') detail = data.detail;
      if (typeof data?.codigo === 'string') code = data.codigo;
    } catch {
      // respuesta sin body JSON (ej. error de red o del propio servidor)
    }
    throw new ApiError(detail, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
