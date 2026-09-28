import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from db.database import Base


def new_id() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Company(Base):
    __tablename__ = 'companies'

    id = Column(String, primary_key=True, default=new_id)
    rut = Column(String, unique=True, nullable=False, index=True)
    nombre = Column(String, nullable=False)
    sector = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    users = relationship('User', back_populates='company')
    documents = relationship('Document', back_populates='company')


class User(Base):
    __tablename__ = 'users'

    id = Column(String, primary_key=True, default=new_id)
    company_id = Column(String, ForeignKey('companies.id'), nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    # Marca si el usuario ya vio (o cerró) el tour de bienvenida al menos una
    # vez, para que no se le muestre automáticamente en próximos inicios de
    # sesión. Vive en el backend (no en localStorage) para que persista entre
    # sesiones y dispositivos.
    onboarding_completed = Column(Boolean, nullable=False, default=False)

    # Fase 5 — segundo factor TOTP opcional.
    # mfa_enabled: el usuario confirmó y activó su segundo factor.
    # mfa_secret_enc: secreto TOTP cifrado con Fernet (nunca en texto plano).
    #   Puede existir con mfa_enabled=False: es el estado "enrolado pero sin
    #   confirmar todavía" entre /auth/mfa/setup y /auth/mfa/activate.
    # mfa_backup_codes: JSON con los hashes bcrypt de los códigos de respaldo
    #   de un solo uso (se muestran una vez, al activar).
    mfa_enabled = Column(Boolean, nullable=False, default=False)
    mfa_secret_enc = Column(String, nullable=True)
    mfa_backup_codes = Column(String, nullable=True)

    created_at = Column(DateTime, default=_utcnow)

    company = relationship('Company', back_populates='users')


class Document(Base):
    __tablename__ = 'documents'

    id = Column(String, primary_key=True, default=new_id)
    company_id = Column(String, ForeignKey('companies.id'), nullable=False, index=True)
    req_id = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    uploaded_by = Column(String, ForeignKey('users.id'), nullable=False)
    uploaded_at = Column(DateTime, default=_utcnow)

    company = relationship('Company', back_populates='documents')


class AuditLog(Base):
    """Bitácora de auditoría append-only con encadenamiento de hashes (Fase 6).

    Ninguna fila se modifica ni se borra tras insertarse: cada evento enlaza
    su hash con el del evento anterior (ver services/audit.py). La tabla ya
    existe en Postgres/Supabase con tipos nativos (bigserial, timestamptz,
    uuid, inet, jsonb, char(64)); este modelo la mapea con tipos genéricos
    de SQLAlchemy para poder crearla también en SQLite (tests), igual que
    el resto de los modelos de este archivo.
    """
    __tablename__ = 'audit_log'

    # BigInteger en Postgres (bigserial ya existe); en SQLite el alias de
    # rowid autoincremental solo funciona con tipo INTEGER exacto, no BIGINT
    # — with_variant conserva ambos comportamientos según el motor.
    id = Column(BigInteger().with_variant(Integer, 'sqlite'), primary_key=True, autoincrement=True)
    ocurrido_en = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    evento = Column(String, nullable=False)
    resultado = Column(String, nullable=False)
    user_id = Column(String, nullable=True)
    company_id = Column(String, nullable=True)
    ip_origen = Column(String, nullable=True)
    detalle = Column(JSON, nullable=True)
    hash_previo = Column(String(64), nullable=False)
    hash_evento = Column(String(64), nullable=False, unique=True)
