import asyncio

import httpx
import pytest

from services.whatsapp import WhatsAppClient, WhatsAppError


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for key in [
        'WHATSAPP_PROVIDER',
        'EVOLUTION_BASE_URL',
        'EVOLUTION_INSTANCE',
        'EVOLUTION_API_KEY',
        'WA_BRIDGE_BASE_URL',
        'WA_BRIDGE_API_KEY',
    ]:
        monkeypatch.delenv(key, raising=False)


def test_bridge_client_healthcheck(monkeypatch):
    monkeypatch.setenv('WHATSAPP_PROVIDER', 'bridge')
    monkeypatch.setenv('WA_BRIDGE_BASE_URL', 'http://bridge.local')

    async def handler(request):
        assert request.url.path == '/health'
        return httpx.Response(200, json={'ok': True, 'connected': True})

    transport = httpx.MockTransport(handler)
    client = WhatsAppClient(transport=transport)

    ok, message = asyncio.run(client.healthcheck())

    assert client.provider == 'bridge'
    assert client.configured is True
    assert ok is True
    assert 'Bridge' in message


def test_bridge_client_send_text(monkeypatch):
    monkeypatch.setenv('WHATSAPP_PROVIDER', 'bridge')
    monkeypatch.setenv('WA_BRIDGE_BASE_URL', 'http://bridge.local')
    monkeypatch.setenv('WA_BRIDGE_API_KEY', 'secret')

    async def handler(request):
        assert request.url.path == '/messages/send-text'
        assert request.headers['x-api-key'] == 'secret'
        assert request.method == 'POST'
        assert request.read() == b'{"phone":"+5511999999999","text":"oi"}'
        return httpx.Response(200, json={'ok': True})

    transport = httpx.MockTransport(handler)
    client = WhatsAppClient(transport=transport)

    asyncio.run(client.send_text('+5511999999999', 'oi'))


def test_bridge_client_send_text_classifies_errors(monkeypatch):
    monkeypatch.setenv('WHATSAPP_PROVIDER', 'bridge')
    monkeypatch.setenv('WA_BRIDGE_BASE_URL', 'http://bridge.local')

    async def handler(_request):
        return httpx.Response(503, text='temporarily down')

    transport = httpx.MockTransport(handler)
    client = WhatsAppClient(transport=transport)

    with pytest.raises(WhatsAppError) as exc:
        asyncio.run(client.send_text('+5511999999999', 'oi'))

    assert exc.value.error_class == 'temporary'
    assert exc.value.http_status == 503


def test_bridge_session(monkeypatch):
    monkeypatch.setenv('WHATSAPP_PROVIDER', 'bridge')
    monkeypatch.setenv('WA_BRIDGE_BASE_URL', 'http://bridge.local')

    async def handler(request):
        assert request.url.path == '/session'
        return httpx.Response(200, json={'ok': True, 'connected': False, 'state': 'qr_ready'})

    transport = httpx.MockTransport(handler)
    client = WhatsAppClient(transport=transport)
    payload = asyncio.run(client.bridge_session())

    assert payload['state'] == 'qr_ready'


def test_bridge_qr(monkeypatch):
    monkeypatch.setenv('WHATSAPP_PROVIDER', 'bridge')
    monkeypatch.setenv('WA_BRIDGE_BASE_URL', 'http://bridge.local')

    async def handler(request):
        assert request.url.path == '/session/qr'
        return httpx.Response(200, json={'ok': True, 'base64': 'data:image/png;base64,abc'})

    transport = httpx.MockTransport(handler)
    client = WhatsAppClient(transport=transport)
    payload = asyncio.run(client.bridge_qr())

    assert payload['base64'].startswith('data:image/png;base64,')


def test_bridge_restart(monkeypatch):
    monkeypatch.setenv('WHATSAPP_PROVIDER', 'bridge')
    monkeypatch.setenv('WA_BRIDGE_BASE_URL', 'http://bridge.local')

    async def handler(request):
        assert request.url.path == '/session/restart'
        assert request.method == 'POST'
        return httpx.Response(200, json={'ok': True, 'message': 'session restarting'})

    transport = httpx.MockTransport(handler)
    client = WhatsAppClient(transport=transport)
    payload = asyncio.run(client.bridge_restart())

    assert payload['ok'] is True


def test_evolution_client_requires_full_credentials(monkeypatch):
    monkeypatch.setenv('WHATSAPP_PROVIDER', 'evolution')
    monkeypatch.setenv('EVOLUTION_BASE_URL', 'http://localhost:8080')

    client = WhatsAppClient()

    assert client.provider == 'evolution'
    assert client.configured is False
    ok, message = asyncio.run(client.healthcheck())
    assert ok is False
    assert 'Credenciais ausentes' in message
