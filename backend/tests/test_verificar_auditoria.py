import json

import pytest

import verificar_auditoria as va
from services.audit import ResultadoVerificacionCadena

URL_OK = 'postgresql://audit_verifier:secreto@localhost:5432/postgres'


@pytest.fixture(autouse=True)
def _sin_env_file(tmp_path, monkeypatch):
    # Ningún test debe depender del backend/.env real.
    monkeypatch.setattr(va, 'ENV_FILE', tmp_path / '.env')


def _con_resultado(monkeypatch, resultado):
    llamadas = []

    def verificar_falso(url, desde_id):
        llamadas.append((url, desde_id))
        return resultado

    monkeypatch.setattr(va, 'verificar', verificar_falso)
    return llamadas


def test_sin_variable_de_entorno_falla_con_instrucciones(capsys):
    codigo = va.main([], environ={})

    assert codigo == va.SALIDA_ERROR
    err = capsys.readouterr().err
    assert 'AUDIT_VERIFIER_DATABASE_URL' in err
    assert 'backend/.env' in err


def test_url_que_no_es_postgres_se_rechaza(capsys):
    codigo = va.main([], environ={va.ENV_VAR_URL: 'sqlite:///./backend.db'})

    assert codigo == va.SALIDA_ERROR
    assert 'PostgreSQL' in capsys.readouterr().err


def test_variable_en_env_file_se_rechaza(monkeypatch, capsys):
    va.ENV_FILE.write_text(f'{va.ENV_VAR_URL}={URL_OK}\n', encoding='utf-8')
    llamadas = _con_resultado(monkeypatch, ResultadoVerificacionCadena(intacta=True, eventos_revisados=0))

    codigo = va.main([], environ={va.ENV_VAR_URL: URL_OK})

    assert codigo == va.SALIDA_ERROR
    assert llamadas == []
    assert 'Quítala' in capsys.readouterr().err


def test_cadena_integra_sale_con_0_y_pasa_desde_id(monkeypatch, capsys):
    llamadas = _con_resultado(monkeypatch, ResultadoVerificacionCadena(
        intacta=True, eventos_revisados=3, id_primero=10, id_ultimo=12,
    ))

    codigo = va.main(['--desde-id', '10'], environ={va.ENV_VAR_URL: URL_OK})

    assert codigo == va.SALIDA_INTEGRA
    assert llamadas == [(URL_OK, 10)]
    salida = capsys.readouterr().out
    assert 'ÍNTEGRA' in salida
    assert '10 – 12' in salida
    assert 'Eventos revisados:  3' in salida


def test_cadena_rota_sale_con_1_e_informa_id_y_motivo(monkeypatch, capsys):
    _con_resultado(monkeypatch, ResultadoVerificacionCadena(
        intacta=False, eventos_revisados=2, id_primera_inconsistencia=2,
        motivo='hash_evento almacenado no coincide con el recalculado', id_primero=1, id_ultimo=2,
    ))

    codigo = va.main([], environ={va.ENV_VAR_URL: URL_OK})

    assert codigo == va.SALIDA_ROTA
    salida = capsys.readouterr().out
    assert 'ROTA' in salida
    assert 'id 2' in salida
    assert 'hash_evento almacenado no coincide' in salida


def test_salida_json(monkeypatch, capsys):
    _con_resultado(monkeypatch, ResultadoVerificacionCadena(
        intacta=False, eventos_revisados=5, id_primera_inconsistencia=7,
        motivo='hash_previo no coincide con el hash_evento del registro anterior', id_primero=3, id_ultimo=7,
    ))

    codigo = va.main(['--json', '--desde-id', '3'], environ={va.ENV_VAR_URL: URL_OK})

    assert codigo == va.SALIDA_ROTA
    datos = json.loads(capsys.readouterr().out)
    assert datos['intacta'] is False
    assert datos['eventos_revisados'] == 5
    assert datos['id_primero'] == 3
    assert datos['id_ultimo'] == 7
    assert datos['id_primera_inconsistencia'] == 7
    assert datos['desde_id'] == 3
    assert 'verificado_en' in datos


def test_sin_eventos_en_el_rango(monkeypatch, capsys):
    _con_resultado(monkeypatch, ResultadoVerificacionCadena(intacta=True, eventos_revisados=0))

    codigo = va.main(['--desde-id', '999'], environ={va.ENV_VAR_URL: URL_OK})

    assert codigo == va.SALIDA_INTEGRA
    assert 'sin eventos' in capsys.readouterr().out


def test_error_de_verificacion_sale_con_2(monkeypatch, capsys):
    def verificar_falla(url, desde_id):
        raise va.ErrorDeVerificacion('La conexión entra como "app_user"')

    monkeypatch.setattr(va, 'verificar', verificar_falla)

    codigo = va.main([], environ={va.ENV_VAR_URL: URL_OK})

    assert codigo == va.SALIDA_ERROR
    assert 'app_user' in capsys.readouterr().err


def test_desde_id_debe_ser_positivo():
    with pytest.raises(SystemExit):
        va.main(['--desde-id', '0'], environ={va.ENV_VAR_URL: URL_OK})
