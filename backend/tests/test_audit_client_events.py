"""Eventos reportados por el cliente (routers/client_events.py, Fase 6).

Estos tests verifican el registro, NO que el diagnóstico o la exportación
hayan ocurrido: el servidor no tiene forma de saberlo (ver la limitación
documentada en el módulo).
"""
from sqlalchemy.orm import sessionmaker

from db.models import AuditLog
from services import audit


def _eventos(client, evento):
    db = sessionmaker(bind=client.db_engine)()
    try:
        return db.query(AuditLog).filter(AuditLog.evento == evento).all()
    finally:
        db.close()


def _registrar(client):
    client.post('/auth/register', json={
        'rut': '11.111.111-1', 'nombre_empresa': 'Empresa Test', 'email': 'admin@a.cl',
        'password': 'Clave-Segura123!', 'sector': 'tecnologia',
    })


def _bitacora_caida(*_args, **_kwargs):
    raise RuntimeError('bitácora no disponible (prueba)')


def test_diagnostico_reportado_queda_marcado_como_no_verificable(client):
    _registrar(client)

    res = client.post('/audit/client-events', json={'evento': 'diagnostico_ejecutado'})

    assert res.status_code == 204
    eventos = _eventos(client, audit.EVENTO_DIAGNOSTICO_EJECUTADO)
    assert len(eventos) == 1
    assert eventos[0].resultado == 'exito'
    assert eventos[0].user_id is not None
    assert eventos[0].detalle == {'origen': 'reportado_por_cliente', 'verificable_por_servidor': False}


def test_exportacion_reportada_queda_registrada(client):
    _registrar(client)

    res = client.post('/audit/client-events', json={'evento': 'exportacion_resultados'})

    assert res.status_code == 204
    eventos = _eventos(client, audit.EVENTO_EXPORTACION_RESULTADOS)
    assert len(eventos) == 1
    assert eventos[0].detalle['origen'] == 'reportado_por_cliente'


def test_evento_fuera_del_catalogo_permitido_se_rechaza(client):
    _registrar(client)
    res = client.post('/audit/client-events', json={'evento': 'documento_eliminado'})
    assert res.status_code == 422


def test_detalle_libre_del_cliente_se_ignora(client):
    _registrar(client)
    client.post('/audit/client-events', json={
        'evento': 'diagnostico_ejecutado', 'detalle': {'rut_tercero': '12.345.678-5'},
    })
    assert '12.345.678-5' not in str(_eventos(client, audit.EVENTO_DIAGNOSTICO_EJECUTADO)[0].detalle)


def test_sin_sesion_devuelve_401(client):
    res = client.post('/audit/client-events', json={'evento': 'diagnostico_ejecutado'})
    assert res.status_code == 401


def test_fallo_de_auditoria_en_exportacion_devuelve_503(client, monkeypatch):
    # exportacion_resultados es crítico: el frontend no genera el PDF.
    _registrar(client)
    monkeypatch.setattr(audit, '_ultimo_hash_global', _bitacora_caida)

    res = client.post('/audit/client-events', json={'evento': 'exportacion_resultados'})

    assert res.status_code == 503


def test_fallo_de_auditoria_en_diagnostico_no_bloquea(client, monkeypatch):
    # diagnostico_ejecutado no está en EVENTOS_CRITICOS (fail-open).
    _registrar(client)
    monkeypatch.setattr(audit, '_ultimo_hash_global', _bitacora_caida)

    res = client.post('/audit/client-events', json={'evento': 'diagnostico_ejecutado'})

    assert res.status_code == 204
