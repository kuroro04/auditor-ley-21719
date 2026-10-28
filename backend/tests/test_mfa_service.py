"""Pruebas de las utilidades criptográficas y TOTP de MFA (Fase 5)."""
import pyotp
import pytest

from core import mfa


def test_cifrar_y_descifrar_secreto_es_reversible_y_no_guarda_texto_plano():
    secreto = pyotp.random_base32()

    cifrado = mfa.encrypt_secret(secreto)

    # El secreto en claro nunca debe aparecer dentro del texto cifrado.
    assert secreto not in cifrado
    assert mfa.decrypt_secret(cifrado) == secreto


def test_generar_secreto_totp_es_base32_valido():
    secreto = mfa.generate_totp_secret()

    # pyotp acepta el secreto y produce un código de 6 dígitos.
    codigo = pyotp.TOTP(secreto).now()
    assert len(codigo) == 6
    assert codigo.isdigit()


def test_verify_code_acepta_el_codigo_actual_y_rechaza_uno_falso():
    secreto = mfa.generate_totp_secret()
    codigo_valido = pyotp.TOTP(secreto).now()

    assert mfa.verify_code(secreto, codigo_valido) is True
    assert mfa.verify_code(secreto, '000000') is False


def test_verify_code_rechaza_entradas_vacias_o_con_ruido():
    secreto = mfa.generate_totp_secret()

    assert mfa.verify_code(secreto, '') is False
    assert mfa.verify_code(secreto, '   ') is False
    assert mfa.verify_code(secreto, 'abcdef') is False


def test_provisioning_uri_incluye_emisor_y_cuenta():
    secreto = mfa.generate_totp_secret()

    uri = mfa.provisioning_uri(secreto, 'persona@empresa.cl')

    assert uri.startswith('otpauth://totp/')
    # El email va URL-encoded dentro de la URI (persona%40empresa.cl).
    assert 'persona' in uri
    assert 'issuer=DataShield' in uri
    assert secreto in uri


def test_qr_svg_data_uri_es_una_imagen_svg_embebida():
    uri = mfa.provisioning_uri(mfa.generate_totp_secret(), 'persona@empresa.cl')

    data_uri = mfa.qr_svg_data_uri(uri)

    assert data_uri.startswith('data:image/svg+xml;base64,')
    # No debe filtrarse el secreto en el string del data URI (va codificado en el QR, no en claro).
    assert 'otpauth' not in data_uri


def test_generar_codigos_de_respaldo_son_unicos_y_del_largo_pedido():
    codigos = mfa.generate_backup_codes(10)

    assert len(codigos) == 10
    assert len(set(codigos)) == 10
    for c in codigos:
        assert c.isalnum()


def test_consumir_codigo_de_respaldo_valido_lo_elimina_de_la_lista():
    codigos = mfa.generate_backup_codes(3)
    almacen = mfa.hash_backup_codes(codigos)

    nuevo_almacen = mfa.consume_backup_code(almacen, codigos[1])

    assert nuevo_almacen is not None
    # El código ya usado no vuelve a servir.
    assert mfa.consume_backup_code(nuevo_almacen, codigos[1]) is None
    # Los otros códigos siguen siendo válidos.
    assert mfa.consume_backup_code(nuevo_almacen, codigos[0]) is not None


def test_verify_code_rechaza_replay_de_mismo_codigo():
    secreto = mfa.generate_totp_secret()
    codigo_valido = pyotp.TOTP(secreto).now()

    assert mfa.verify_code(secreto, codigo_valido) is True
    # Con el mismo código pasado como last_code, debe ser rechazado
    assert mfa.verify_code(secreto, codigo_valido, last_code=codigo_valido) is False


def test_consumir_codigo_de_respaldo_invalido_devuelve_none():
    almacen = mfa.hash_backup_codes(mfa.generate_backup_codes(3))

    assert mfa.consume_backup_code(almacen, 'NOEXISTE') is None
    assert mfa.consume_backup_code(None, 'NOEXISTE') is None
