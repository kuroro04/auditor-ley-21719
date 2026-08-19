from services.rut_service import is_valid_rut, normalize_rut


def test_rut_valido_con_puntos_y_guion():
    assert is_valid_rut('11.111.111-1') is True


def test_rut_valido_sin_formato():
    assert is_valid_rut('111111111') is True


def test_rut_con_digito_verificador_incorrecto():
    assert is_valid_rut('11.111.111-2') is False


def test_rut_con_formato_invalido():
    assert is_valid_rut('abc') is False
    assert is_valid_rut('123') is False


def test_normalize_rut_quita_puntos_guion_espacios_y_pone_mayusculas():
    assert normalize_rut(' 11.111.111-1 ') == '111111111'
    assert normalize_rut('7.654.321-k') == '7654321K'
