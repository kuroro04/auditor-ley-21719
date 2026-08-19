import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
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
