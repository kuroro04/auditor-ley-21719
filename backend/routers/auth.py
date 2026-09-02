import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from core.config import COOKIE_SECURE, COOKIE_NAME, COOKIE_MAX_AGE_SECONDS
from core.deps import CurrentUser, get_current_user, get_tenant_db
from core.security import create_access_token, hash_password, verify_password
from db.database import get_db
from db.models import Company, User
from db.tenant import find_user_by_email, set_tenant_context
from models.schemas import LoginRequest, RegisterRequest, SessionResponse
from services.rut_service import is_valid_rut, normalize_rut

router = APIRouter(prefix='/auth', tags=['auth'])


def _set_session_cookie(response: Response, token: str) -> None:
    # httpOnly: el JavaScript del navegador nunca puede leer ni robar este
    # valor (a diferencia de localStorage/sessionStorage, que cualquier script
    # que corra en la página -incluido uno inyectado por XSS- sí puede leer).
    # El navegador la reenvía solo en cada request al backend gracias a
    # credentials:'include' en el fetch del frontend.
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite='lax',
        secure=COOKIE_SECURE,
        max_age=COOKIE_MAX_AGE_SECONDS,
        path='/',
    )


@router.post('/register', response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    if not is_valid_rut(payload.rut):
        raise HTTPException(status_code=400, detail='RUT inválido')

    rut_normalizado = normalize_rut(payload.rut)
    email_normalizado = payload.email.lower()

    if db.query(Company).filter(Company.rut == rut_normalizado).first():
        # No se une automáticamente al usuario a la empresa existente: el RUT
        # es información pública en Chile, así que auto-unirse solo con el
        # RUT sería un hueco de seguridad. Incorporar usuarios a una empresa
        # ya registrada es responsabilidad de su administrador (flujo de
        # "invitar usuarios" queda para una fase futura).
        raise HTTPException(
            status_code=409,
            detail='Esta empresa ya está registrada. Si perteneces a ella, solicita a tu administrador que te dé acceso.',
        )
    if db.query(User).filter(User.email == email_normalizado).first():
        raise HTTPException(status_code=409, detail='Ese correo ya está registrado')

    company_id = str(uuid.uuid4())
    company = Company(
        id=company_id, rut=rut_normalizado, nombre=payload.nombre_empresa, sector=payload.sector,
    )
    db.add(company)

    # Fija el contexto de tenant ANTES de insertar el primer usuario: la
    # política RLS de `users` exige que company_id coincida con el
    # contexto de la transacción, incluso para el INSERT.
    set_tenant_context(db, company_id)

    user = User(
        id=str(uuid.uuid4()), company_id=company_id, email=email_normalizado,
        password_hash=hash_password(payload.password), role='administrador',
    )
    db.add(user)
    db.commit()

    token = create_access_token(user.id, company_id, user.role)
    _set_session_cookie(response, token)
    return SessionResponse(
        email=user.email, role=user.role, company_id=company_id,
        company_nombre=company.nombre, company_sector=company.sector,
        onboarding_completed=user.onboarding_completed,
    )


@router.post('/login', response_model=SessionResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email_normalizado = payload.email.lower()
    user = find_user_by_email(db, email_normalizado)
    # Mensaje genérico a propósito: no revela si falló el correo o la
    # contraseña, para no ayudar a un atacante a enumerar correos válidos.
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail='Correo o contraseña incorrectos')

    set_tenant_context(db, user.company_id)
    company = db.query(Company).filter(Company.id == user.company_id).first()
    token = create_access_token(user.id, user.company_id, user.role)
    _set_session_cookie(response, token)
    return SessionResponse(
        email=user.email, role=user.role, company_id=company.id,
        company_nombre=company.nombre, company_sector=company.sector,
        onboarding_completed=user.onboarding_completed,
    )


@router.get('/me', response_model=SessionResponse)
def me(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_tenant_db)):
    user = db.query(User).filter(User.id == current.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail='Sesión inválida')
    company = db.query(Company).filter(Company.id == user.company_id).first()
    return SessionResponse(
        email=user.email, role=user.role, company_id=company.id,
        company_nombre=company.nombre, company_sector=company.sector,
        onboarding_completed=user.onboarding_completed,
    )


@router.post('/complete-onboarding', status_code=status.HTTP_204_NO_CONTENT)
def complete_onboarding(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_tenant_db)):
    # current.user_id viene del JWT verificado por el servidor, nunca de un
    # parámetro del cliente: un usuario solo puede marcar su propio onboarding.
    user = db.query(User).filter(User.id == current.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail='Sesión inválida')
    user.onboarding_completed = True
    db.commit()


@router.post('/logout', status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path='/')
