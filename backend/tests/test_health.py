from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_devuelve_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
