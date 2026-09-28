import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from core.config import COOKIE_SECURE, COOKIE_NAME, COOKIE_MAX_AGE_SECONDS
from core.deps import CurrentUser, get_current_user, get_tenant_db
from core.security import (
    create_access_token,
    create_mfa_challenge_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from core import mfa
from db.database import get_db
from db.models import Company, User
from db.tenant import find_user_by_email, set_tenant_context
from models.schemas import (
    LoginRequest,
    MfaActivateResponse,
    MfaCodeRequest,
    MfaDisableRequest,
    MfaLoginChallenge,
    MfaLoginRequest,
    MfaSetupResponse,
    RegisterRequest,
    SessionResponse,
)
from services.rut_service import is_valid_rut, normalize_rut

router = APIRouter(prefix='/auth', tags=['auth'])

# Mensaje único para todos los fallos del segundo paso de login: no revela si
# falló el código, el token intermedio o su expiración.
_MFA_LOGIN_ERROR = 'Código de verificación inválido'


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


def _session_response(user: User, company: Company) -> SessionResponse:
    return SessionResponse(
        email=user.email, role=user.role, company_id=company.id,
        company_nombre=company.nombre, company_sector=company.sector,
        onboarding_completed=user.onboarding_completed,
        mfa_enabled=bool(user.mfa_enabled),
    )


def _issue_session(response: Response, user: User, company: Company) -> SessionResponse:
    token = create_access_token(user.id, company.id, user.role)
    _set_session_cookie(response, token)
    return _session_response(user, company)


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

    return _issue_session(response, user, company)


@router.post('/login')
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email_normalizado = payload.email.lower()
    user = find_user_by_email(db, email_normalizado)
    # Mensaje genérico a propósito: no revela si falló el correo o la
    # contraseña, para no ayudar a un atacante a enumerar correos válidos.
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail='Correo o contraseña incorrectos')

    # Fase 5 — si el usuario tiene segundo factor, la contraseña sola NO
    # entrega la sesión: se devuelve un token corto para canjear el código
    # TOTP en /auth/login/mfa. Sin MFA, el flujo es idéntico al de antes.
    if user.mfa_enabled:
        return MfaLoginChallenge(mfa_token=create_mfa_challenge_token(user.id, user.company_id))

    set_tenant_context(db, user.company_id)
    company = db.query(Company).filter(Company.id == user.company_id).first()
    return _issue_session(response, user, company)


@router.post('/login/mfa', response_model=SessionResponse)
def login_mfa(payload: MfaLoginRequest, response: Response, db: Session = Depends(get_db)):
    """Segundo paso del login con MFA: canjea el token corto + código por la sesión."""
    try:
        claims = decode_access_token(payload.mfa_token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail=_MFA_LOGIN_ERROR)
    if not claims.get('mfa_pending'):
        raise HTTPException(status_code=401, detail=_MFA_LOGIN_ERROR)

    # Con company_id del token ya podemos fijar el contexto RLS y leer al
    # usuario por id sin ninguna excepción a las políticas de la Fase 3.
    set_tenant_context(db, claims['company_id'])
    user = db.query(User).filter(User.id == claims['sub']).first()
    if not user or not user.mfa_enabled or not user.mfa_secret_enc:
        raise HTTPException(status_code=401, detail=_MFA_LOGIN_ERROR)

    secreto = mfa.decrypt_secret(user.mfa_secret_enc)
    if mfa.verify_code(secreto, payload.code):
        pass
    else:
        # ¿Es un código de respaldo? Si coincide, se consume (un solo uso).
        nuevo_almacen = mfa.consume_backup_code(user.mfa_backup_codes, payload.code)
        if nuevo_almacen is None:
            raise HTTPException(status_code=401, detail=_MFA_LOGIN_ERROR)
        user.mfa_backup_codes = nuevo_almacen
        db.commit()

    company = db.query(Company).filter(Company.id == user.company_id).first()
    return _issue_session(response, user, company)


@router.get('/me', response_model=SessionResponse)
def me(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_tenant_db)):
    user = db.query(User).filter(User.id == current.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail='Sesión inválida')
    company = db.query(Company).filter(Company.id == user.company_id).first()
    return _session_response(user, company)


# --- Fase 5: administración del segundo factor (usuario ya autenticado) ---

@router.post('/mfa/setup', response_model=MfaSetupResponse)
def mfa_setup(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_tenant_db)):
    """Genera (o regenera) un secreto TOTP pendiente y devuelve los datos del QR.

    El secreto se guarda cifrado, pero mfa_enabled sigue en False hasta que
    el usuario confirme con un primer código en /auth/mfa/activate.
    """
    user = db.query(User).filter(User.id == current.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail='Sesión inválida')
    if user.mfa_enabled:
        raise HTTPException(status_code=409, detail='El segundo factor ya está activo. Desactívalo primero para reconfigurarlo.')

    # Reutiliza el secreto pendiente si ya existe: si el usuario vuelve a esta
    # pantalla, el QR que ya escaneó debe seguir siendo válido.
    if user.mfa_secret_enc:
        secreto = mfa.decrypt_secret(user.mfa_secret_enc)
    else:
        secreto = mfa.generate_totp_secret()
        user.mfa_secret_enc = mfa.encrypt_secret(secreto)
        db.commit()
    
    

    uri = mfa.provisioning_uri(secreto, user.email)
    return MfaSetupResponse(otpauth_uri=uri, secret_base32=secreto, qr_svg=mfa.qr_svg_data_uri(uri))


@router.post('/mfa/activate', response_model=MfaActivateResponse)
def mfa_activate(
    payload: MfaCodeRequest,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_tenant_db),
):
    """Confirma el enrolamiento: solo si el primer código es válido se activa el MFA."""
    user = db.query(User).filter(User.id == current.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail='Sesión inválida')
    if user.mfa_enabled:
        raise HTTPException(status_code=409, detail='El segundo factor ya está activo.')
    if not user.mfa_secret_enc:
        raise HTTPException(status_code=400, detail='Primero solicita la configuración del segundo factor.')

    secreto = mfa.decrypt_secret(user.mfa_secret_enc)
    if not mfa.verify_code(secreto, payload.code):
        raise HTTPException(status_code=400, detail='Código de verificación inválido')

    codigos = mfa.generate_backup_codes(10)
    user.mfa_backup_codes = mfa.hash_backup_codes(codigos)
    user.mfa_enabled = True
    db.commit()

    return MfaActivateResponse(backup_codes=codigos)


@router.post('/mfa/disable', status_code=status.HTTP_204_NO_CONTENT)
def mfa_disable(
    payload: MfaDisableRequest,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_tenant_db),
):
    """Desactiva el segundo factor. Exige confirmar con la contraseña o un código válido."""
    user = db.query(User).filter(User.id == current.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail='Sesión inválida')
    if not user.mfa_enabled:
        raise HTTPException(status_code=400, detail='El segundo factor no está activo.')

    confirmado = False
    if payload.password and verify_password(payload.password, user.password_hash):
        confirmado = True
    elif payload.code and user.mfa_secret_enc:
        secreto = mfa.decrypt_secret(user.mfa_secret_enc)
        if mfa.verify_code(secreto, payload.code):
            confirmado = True
        elif mfa.consume_backup_code(user.mfa_backup_codes, payload.code) is not None:
            confirmado = True
    if not confirmado:
        raise HTTPException(status_code=400, detail='Confirmación inválida: revisa tu contraseña o el código.')

    user.mfa_enabled = False
    user.mfa_secret_enc = None
    user.mfa_backup_codes = None
    db.commit()


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
