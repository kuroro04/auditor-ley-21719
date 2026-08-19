import time

import jwt
import pytest

from core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from core import config


def test_hash_password_nunca_devuelve_el_texto_plano():
    hashed = hash_password('Clave-Segura123!')
    assert hashed != 'Clave-Segura123!'
    assert verify_password('Clave-Segura123!', hashed) is True


def test_verify_password_rechaza_contrasena_incorrecta():
    hashed = hash_password('Clave-Segura123!')
    assert verify_password('otra-clave', hashed) is False


def test_create_and_decode_access_token_conserva_claims():
    token = create_access_token(user_id='u1', company_id='c1', role='administrador')
    payload = decode_access_token(token)
    assert payload['sub'] == 'u1'
    assert payload['company_id'] == 'c1'
    assert payload['role'] == 'administrador'


def test_decode_access_token_rechaza_token_expirado():
    expired = jwt.encode(
        {'sub': 'u1', 'company_id': 'c1', 'role': 'administrador', 'exp': time.time() - 10},
        config.SECRET_KEY,
        algorithm=config.ALGORITHM,
    )
    with pytest.raises(jwt.PyJWTError):
        decode_access_token(expired)
