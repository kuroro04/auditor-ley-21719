from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    rut: str
    nombre_empresa: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    sector: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SessionResponse(BaseModel):
    email: str
    role: str
    company_id: str
    company_nombre: str
    company_sector: Optional[str] = None
    onboarding_completed: bool = False
    # Fase 5 — indica al frontend si este usuario tiene el segundo factor activo.
    mfa_enabled: bool = False


# --- Fase 5: segundo factor TOTP opcional ---

class MfaSetupResponse(BaseModel):
    # Datos para pintar el QR y permitir el tipeo manual del secreto.
    otpauth_uri: str
    secret_base32: str
    qr_svg: str  # imagen SVG embebida en un data URI


class MfaCodeRequest(BaseModel):
    code: str


class MfaActivateResponse(BaseModel):
    # Los códigos de respaldo se devuelven UNA sola vez, en claro.
    backup_codes: list[str]


class MfaDisableRequest(BaseModel):
    # Se confirma con la contraseña actual O con un código válido (TOTP o de respaldo).
    password: Optional[str] = None
    code: Optional[str] = None


class MfaLoginChallenge(BaseModel):
    mfa_required: bool = True
    mfa_token: str  # token corto (5 min) que habilita el segundo paso


class MfaLoginRequest(BaseModel):
    mfa_token: str
    code: str


class ClientEventRequest(BaseModel):
    # Solo el nombre del evento: el cliente no puede mandar `detalle` libre,
    # para que nunca termine contenido de documentos o datos de terceros en
    # la bitácora por esta vía.
    evento: Literal['diagnostico_ejecutado', 'exportacion_resultados']


class DocumentOut(BaseModel):
    id: str
    req_id: str
    filename: str
    content_type: str
    size_bytes: int
    uploaded_at: str
