from fastapi.testclient import TestClient

import main
from services.whatsapp import WhatsAppError


class _FakeBridgeClient:
    provider = 'bridge'

    async def bridge_session(self):
        return {'connected': False, 'state': 'qr_ready', 'phone': '5581999999999'}

    async def bridge_qr(self):
        return {'base64': 'data:image/png;base64,abc'}

    async def bridge_restart(self):
        return {'ok': True, 'message': 'session restarting'}

    async def bridge_reset(self):
        return {'ok': True, 'message': 'session reset'}


class _FailingBridgeClient:
    provider = 'bridge'

    async def bridge_session(self):
        raise WhatsAppError('Connection refused')

    async def bridge_qr(self):
        raise WhatsAppError('Connection refused')

    async def bridge_restart(self):
        raise WhatsAppError('Connection refused')

    async def bridge_reset(self):
        raise WhatsAppError('Connection refused')


def test_bridge_routes_require_auth():
    client = TestClient(main.app)
    response = client.get('/bridge/session')
    assert response.status_code == 401


def test_bridge_routes_with_auth(monkeypatch):
    monkeypatch.setattr(main, 'WhatsAppClient', _FakeBridgeClient)
    client = TestClient(main.app)
    client.cookies.set('mass_sender_admin', main.APP_PASSWORD)

    session = client.get('/bridge/session')
    assert session.status_code == 200
    assert session.json()['ok'] is True
    assert session.json()['session']['state'] == 'qr_ready'

    qr = client.get('/bridge/qr')
    assert qr.status_code == 200
    assert qr.json()['ok'] is True
    assert qr.json()['qr']['base64'].startswith('data:image/png;base64,')

    restart = client.post('/bridge/restart')
    assert restart.status_code == 200
    assert restart.json()['ok'] is True

    reset = client.post('/bridge/reset')
    assert reset.status_code == 200
    assert reset.json()['ok'] is True


def test_bridge_routes_return_friendly_hint_on_bridge_down(monkeypatch):
    monkeypatch.setattr(main, 'WhatsAppClient', _FailingBridgeClient)
    client = TestClient(main.app)
    client.cookies.set('mass_sender_admin', main.APP_PASSWORD)

    response = client.get('/bridge/session')
    assert response.status_code == 502
    payload = response.json()
    assert payload['ok'] is False
    assert 'indisponível' in payload['message'].lower()
    assert 'npm start' in payload['hint']
