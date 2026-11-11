import uuid
from datetime import datetime, timezone

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
from db.models import Company, Document, User
from db.tenant import find_user_by_email, set_tenant_context
from models.schemas import (
    CompanyOut,
    CompanyUpdate,
    CreateTeamUserRequest,
    LoginRequest,
    MfaActivateResponse,
    MfaCodeRequest,
    MfaDisableRequest,
    MfaLoginChallenge,
    MfaLoginRequest,
    MfaSetupResponse,
    RegisterRequest,
    SessionResponse,
    TeamUserOut,
    UpdateUserRoleRequest,
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
    version = getattr(user, 'token_version', 1) or 1
    token = create_access_token(user.id, company.id, user.role, token_version=version)
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

    # Hallazgo A04: Bloqueo de fila en PostgreSQL para verificación atómica de TOTP contra repetición multi-worker
    query = db.query(User).filter(User.id == claims['sub'])
    if db.get_bind().dialect.name == 'postgresql':
        query = query.with_for_update()
    user = query.first()
    if not user or not user.mfa_enabled or not user.mfa_secret_enc:
        _rechazar(user_id=claims.get('sub'), company_id=claims.get('company_id'))

    secreto = mfa.decrypt_secret(user.mfa_secret_enc)
    limpio_code = payload.code.strip().replace(' ', '')
    if mfa.is_totp_replayed(user.id, limpio_code):
        _rechazar(user_id=user.id, company_id=user.company_id)

    valid_totp, matched_step = mfa.verify_totp_step(secreto, limpio_code, last_step=user.last_totp_step)
    if valid_totp and matched_step is not None:
        user.last_totp_step = matched_step
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
    response: Response,
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
    # Hallazgo A04: Rotar token_version para revocar sesiones antiguas previas a MFA
    user.token_version = (getattr(user, 'token_version', 1) or 1) + 1
    user.last_totp_step = None

    audit.registrar_evento(
        db, audit.EVENTO_MFA_ACTIVADO, 'exito',
        user_id=user.id, company_id=user.company_id, ip_origen=client_ip(request),
    )
    db.commit()

    company = db.query(Company).filter(Company.id == user.company_id).first()
    if company:
        _issue_session(response, user, company)

    return MfaActivateResponse(backup_codes=codigos)


@router.post('/mfa/disable', status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit('5/minute')
def mfa_disable(
    payload: MfaDisableRequest,
    request: Request,
    response: Response,
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
    # Hallazgo A04: Rotar token_version al desactivar MFA
    user.token_version = (getattr(user, 'token_version', 1) or 1) + 1
    user.last_totp_step = None

    audit.registrar_evento(
        db, audit.EVENTO_MFA_DESACTIVADO, 'exito',
        user_id=user.id, company_id=user.company_id, ip_origen=client_ip(request),
    )
    db.commit()
    company = db.query(Company).filter(Company.id == user.company_id).first()
    if company:
        _issue_session(response, user, company)


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
            user_id = claims.get('sub')
            token_ver = claims.get('ver')
            if company_id:
                # Igual que en login/mfa: un company_id no nulo necesita el
                # contexto de tenant fijado para pasar la política de INSERT
                # de audit_log. logout usa get_db (no get_tenant_db), así que
                # nadie lo fijó todavía en esta request.
                set_tenant_context(db, company_id)
            if user_id and token_ver is not None:
                user = db.query(User).filter(User.id == user_id).first()
                # Hallazgo A03: Solo incrementar si la versión presentada coincide con la versión activa
                if user and (getattr(user, 'token_version', 1) or 1) == token_ver:
                    user.token_version = token_ver + 1
                    audit.registrar_evento(
                        db, audit.EVENTO_CIERRE_SESION, 'exito',
                        user_id=user_id, company_id=company_id,
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


# ═══════════════════════════════════════════════════════════════════════════
# Opción 4: Gestión de Roles, Permisos y Perfil Corporativo
# ═══════════════════════════════════════════════════════════════════════════

@router.get('/company', response_model=CompanyOut)
def get_company_profile(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_tenant_db)):
    company = db.query(Company).filter(Company.id == current.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail='Empresa no encontrada')
    total_users = db.query(User).filter(User.company_id == current.company_id).count()
    total_documents = db.query(Document).filter(Document.company_id == current.company_id).count()
    return CompanyOut(
        id=company.id,
        rut=company.rut,
        nombre=company.nombre,
        sector=company.sector,
        created_at=company.created_at.isoformat() if company.created_at else None,
        total_users=total_users,
        total_documents=total_documents,
    )


@router.put('/company', response_model=CompanyOut)
def update_company_profile(
    payload: CompanyUpdate,
    request: Request,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_tenant_db),
):
    if current.role != 'administrador':
        raise HTTPException(status_code=403, detail='Solo el administrador puede actualizar los datos de la empresa')
    company = db.query(Company).filter(Company.id == current.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail='Empresa no encontrada')

    if payload.nombre is not None:
        company.nombre = payload.nombre.strip()
    if payload.sector is not None:
        company.sector = payload.sector.strip()

    audit.registrar_evento(
        db, audit.EVENTO_EMPRESA_ACTUALIZADA, 'exito',
        user_id=current.user_id, company_id=current.company_id,
        ip_origen=client_ip(request),
        detalle={'nombre_nuevo': company.nombre, 'sector_nuevo': company.sector},
    )
    db.commit()

    total_users = db.query(User).filter(User.company_id == current.company_id).count()
    total_documents = db.query(Document).filter(Document.company_id == current.company_id).count()
    return CompanyOut(
        id=company.id,
        rut=company.rut,
        nombre=company.nombre,
        sector=company.sector,
        created_at=company.created_at.isoformat() if company.created_at else None,
        total_users=total_users,
        total_documents=total_documents,
    )


@router.get('/users', response_model=list[TeamUserOut])
def list_team_users(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_tenant_db)):
    if current.role not in ('administrador', 'auditor'):
        raise HTTPException(status_code=403, detail='No tiene permisos para ver el equipo')
    users = db.query(User).filter(User.company_id == current.company_id).order_by(User.created_at.asc()).all()
    return [
        TeamUserOut(
            id=u.id,
            email=u.email,
            role=u.role,
            mfa_enabled=bool(u.mfa_enabled),
            onboarding_completed=bool(u.onboarding_completed),
            created_at=u.created_at.isoformat() if u.created_at else None,
        )
        for u in users
    ]


@router.post('/users', response_model=TeamUserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit('10/hour')
def create_team_user(
    request: Request,
    payload: CreateTeamUserRequest,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_tenant_db),
):
    if current.role != 'administrador':
        raise HTTPException(status_code=403, detail='Solo el administrador puede agregar usuarios')
    email_normalizado = payload.email.lower()

    if db.query(User).filter(User.email == email_normalizado).first():
        raise HTTPException(status_code=409, detail='Ese correo ya está registrado en el sistema')

    nuevo_user = User(
        id=str(uuid.uuid4()),
        company_id=current.company_id,
        email=email_normalizado,
        password_hash=hash_password(payload.password),
        role=payload.role,
        token_version=1,
    )
    db.add(nuevo_user)
    audit.registrar_evento(
        db, audit.EVENTO_USUARIO_CREADO, 'exito',
        user_id=current.user_id, company_id=current.company_id,
        ip_origen=client_ip(request),
        detalle={'email_nuevo_usuario': email_normalizado, 'rol_asignado': payload.role},
    )
    db.commit()

    return TeamUserOut(
        id=nuevo_user.id,
        email=nuevo_user.email,
        role=nuevo_user.role,
        mfa_enabled=False,
        onboarding_completed=False,
        created_at=nuevo_user.created_at.isoformat() if nuevo_user.created_at else None,
    )


@router.patch('/users/{user_id}/role', response_model=TeamUserOut)
def update_user_role(
    user_id: str,
    payload: UpdateUserRoleRequest,
    request: Request,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_tenant_db),
):
    if current.role != 'administrador':
        raise HTTPException(status_code=403, detail='Solo el administrador puede modificar roles')

    user = db.query(User).filter(User.id == user_id, User.company_id == current.company_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Usuario no encontrado en esta empresa')

    if user.id == current.user_id and payload.role != 'administrador':
        admin_count = db.query(User).filter(
            User.company_id == current.company_id,
            User.role == 'administrador',
        ).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail='No puedes cambiar tu propio rol: debe existir al menos un administrador activo en la empresa.',
            )

    rol_anterior = user.role
    user.role = payload.role
    user.token_version = (getattr(user, 'token_version', 1) or 1) + 1

    audit.registrar_evento(
        db, audit.EVENTO_ROL_USUARIO_ACTUALIZADO, 'exito',
        user_id=current.user_id, company_id=current.company_id,
        ip_origen=client_ip(request),
        detalle={'usuario_afectado': user.email, 'rol_anterior': rol_anterior, 'rol_nuevo': payload.role},
    )
    db.commit()

    return TeamUserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        mfa_enabled=bool(user.mfa_enabled),
        onboarding_completed=bool(user.onboarding_completed),
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.post('/revoke-sessions')
def revoke_other_sessions(
    request: Request,
    response: Response,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_tenant_db),
):
    user = db.query(User).filter(User.id == current.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail='Sesión inválida')

    user.token_version = (getattr(user, 'token_version', 1) or 1) + 1
    audit.registrar_evento(
        db, audit.EVENTO_SESIONES_REVOCADAS, 'exito',
        user_id=user.id, company_id=user.company_id, ip_origen=client_ip(request),
    )
    db.commit()

    company = db.query(Company).filter(Company.id == user.company_id).first()
    if company:
        _issue_session(response, user, company)

    return {'ok': True, 'token_version': user.token_version, 'message': 'Sesiones en otros dispositivos revocadas exitosamente.'}
