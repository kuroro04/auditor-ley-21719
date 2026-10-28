import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from core.config import COOKIE_SECURE, COOKIE_NAME, COOKIE_MAX_AGE_SECONDS
from core.deps import CurrentUser, client_ip, get_current_user, get_tenant_db
from core.limiter import limiter
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
from services import audit
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
@limiter.limit('5/hour')
def register(request: Request, payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
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

    audit.registrar_evento(
        db, audit.EVENTO_EMPRESA_REGISTRADA, 'exito',
        user_id=user.id, company_id=company_id, ip_origen=client_ip(request),
    )
    db.commit()

    return _issue_session(response, user, company)


@router.post('/login')
@limiter.limit('10/5minute')
def login(request: Request, payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email_normalizado = payload.email.lower()
    user = find_user_by_email(db, email_normalizado)
    ip = client_ip(request)

    # Mensaje genérico a propósito: no revela si falló el correo o la
    # contraseña, para no ayudar a un atacante a enumerar correos válidos.
    if not user or not verify_password(payload.password, user.password_hash):
        # Sin usuario válido no hay company_id que resolver todavía, así que
        # el contexto de tenant no se fija (y no hace falta: la política de
        # INSERT de audit_log acepta company_id NULL a propósito para estos
        # eventos "de sistema", ver db/rls_policies.sql #5). Se registra el
        # correo intentado —nunca la contraseña— para poder detectar fuerza
        # bruta contra una cuenta puntual.
        audit.registrar_evento(
            db, audit.EVENTO_LOGIN_FALLIDO, 'fallo',
            ip_origen=ip, detalle={'email_intentado': email_normalizado},
        )
        db.commit()
        raise HTTPException(status_code=401, detail='Correo o contraseña incorrectos')

    # Fase 5 — si el usuario tiene segundo factor, la contraseña sola NO
    # entrega la sesión: se devuelve un token corto para canjear el código
    # TOTP en /auth/login/mfa. Sin MFA, el flujo es idéntico al de antes.
    if user.mfa_enabled:
        # company_id ya se conoce (viene del usuario encontrado), así que
        # hay que fijar el contexto de tenant antes del INSERT: la política
        # RLS de audit_log exige que coincida con current_setting(...) para
        # cualquier fila que no lleve company_id NULL.
        set_tenant_context(db, user.company_id)
        audit.registrar_evento(
            db, audit.EVENTO_LOGIN_EXITOSO, 'exito',
            user_id=user.id, company_id=user.company_id, ip_origen=ip,
            detalle={'mfa_requerido': True},
        )
        db.commit()
        return MfaLoginChallenge(mfa_token=create_mfa_challenge_token(user.id, user.company_id))

    set_tenant_context(db, user.company_id)
    company = db.query(Company).filter(Company.id == user.company_id).first()
    audit.registrar_evento(
        db, audit.EVENTO_LOGIN_EXITOSO, 'exito',
        user_id=user.id, company_id=user.company_id, ip_origen=ip,
    )
    db.commit()
    return _issue_session(response, user, company)


@router.post('/login/mfa', response_model=SessionResponse)
@limiter.limit('5/5minute')
def login_mfa(request: Request, payload: MfaLoginRequest, response: Response, db: Session = Depends(get_db)):
    """Segundo paso del login con MFA: canjea el token corto + código por la sesión."""
    ip = client_ip(request)

    def _rechazar(user_id=None, company_id=None):
        # Registra el rechazo y aborta el request: todas las salidas de
        # fallo de este endpoint terminan acá, para no repetir el registro
        # de auditoría en cada punto de salida.
        audit.registrar_evento(
            db, audit.EVENTO_MFA_RECHAZADO, 'fallo',
            user_id=user_id, company_id=company_id, ip_origen=ip,
        )
        db.commit()
        raise HTTPException(status_code=401, detail=_MFA_LOGIN_ERROR)

    try:
        claims = decode_access_token(payload.mfa_token)
    except jwt.PyJWTError:
        _rechazar()

    # Con company_id del token ya podemos fijar el contexto RLS: tanto para
    # leer al usuario por id (política de la Fase 3) como para que un
    # eventual EVENTO_MFA_RECHAZADO de acá en adelante lleve un company_id
    # no nulo y aun así pase la política de INSERT de audit_log.
    set_tenant_context(db, claims['company_id'])

    if not claims.get('mfa_pending'):
        _rechazar(user_id=claims.get('sub'), company_id=claims.get('company_id'))

    user = db.query(User).filter(User.id == claims['sub']).first()
    if not user or not user.mfa_enabled or not user.mfa_secret_enc:
        _rechazar(user_id=claims.get('sub'), company_id=claims.get('company_id'))

    secreto = mfa.decrypt_secret(user.mfa_secret_enc)
    limpio_code = payload.code.strip().replace(' ', '')
    if mfa.is_totp_replayed(user.id, limpio_code):
        _rechazar(user_id=user.id, company_id=user.company_id)

    if mfa.verify_code(secreto, payload.code):
        mfa.mark_totp_consumed(user.id, limpio_code)
    else:
        # ¿Es un código de respaldo? Si coincide, se consume (un solo uso).
        nuevo_almacen = mfa.consume_backup_code(user.mfa_backup_codes, payload.code)
        if nuevo_almacen is None:
            _rechazar(user_id=user.id, company_id=user.company_id)
        user.mfa_backup_codes = nuevo_almacen

    company = db.query(Company).filter(Company.id == user.company_id).first()
    audit.registrar_evento(
        db, audit.EVENTO_MFA_SUPERADO, 'exito',
        user_id=user.id, company_id=user.company_id, ip_origen=ip,
    )
    db.commit()
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
@limiter.limit('5/minute')
def mfa_setup(request: Request, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_tenant_db)):
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
@limiter.limit('5/minute')
def mfa_activate(
    request: Request,
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

    audit.registrar_evento(
        db, audit.EVENTO_MFA_ACTIVADO, 'exito',
        user_id=user.id, company_id=user.company_id, ip_origen=client_ip(request),
    )
    db.commit()

    return MfaActivateResponse(backup_codes=codigos)


@router.post('/mfa/disable', status_code=status.HTTP_204_NO_CONTENT)
def mfa_disable(
    payload: MfaDisableRequest,
    request: Request,
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

    audit.registrar_evento(
        db, audit.EVENTO_MFA_DESACTIVADO, 'exito',
        user_id=user.id, company_id=user.company_id, ip_origen=client_ip(request),
    )
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
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    # Sigue siendo idempotente a propósito (nunca 401): se puede llamar sin
    # cookie o con una ya vencida y de todas formas borra lo que haya. Solo
    # se registra el evento cuando hubo una sesión real que cerrar — sin
    # cookie válida no hay nada que auditar.
    token = request.cookies.get(COOKIE_NAME)
    if token:
        try:
            claims = decode_access_token(token)
        except jwt.PyJWTError:
            claims = None
        if claims and not claims.get('mfa_pending'):
            company_id = claims.get('company_id')
            if company_id:
                # Igual que en login/mfa: un company_id no nulo necesita el
                # contexto de tenant fijado para pasar la política de INSERT
                # de audit_log. logout usa get_db (no get_tenant_db), así que
                # nadie lo fijó todavía en esta request.
                set_tenant_context(db, company_id)
            audit.registrar_evento(
                db, audit.EVENTO_CIERRE_SESION, 'exito',
                user_id=claims.get('sub'), company_id=company_id,
                ip_origen=client_ip(request),
            )
            db.commit()

    response.delete_cookie(
        COOKIE_NAME,
        path='/',
        httponly=True,
        samesite='lax',
        secure=COOKIE_SECURE,
    )
