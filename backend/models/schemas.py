from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    rut: str
    nombre_empresa: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)
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


class DocumentOut(BaseModel):
    id: str
    req_id: str
    filename: str
    content_type: str
    size_bytes: int
    uploaded_at: str
