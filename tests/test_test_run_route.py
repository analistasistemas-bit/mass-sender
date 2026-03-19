from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
from database import Base
from models import Campaign, Contact


def build_session():
    engine = create_engine(
        'sqlite://',
        future=True,
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine, future=True)
    Base.metadata.create_all(engine)
    return Session()


class _BridgeTestClient:
    provider = 'bridge'
    configured = True

    def __init__(self):
        self.sent = []

    async def bridge_session(self):
        return {'ok': True, 'connected': True, 'state': 'ready', 'phone': '5581999998888'}

    async def send_text(self, phone, text):
        self.sent.append((phone, text))


def test_test_run_sends_samples_to_connected_bridge_number(monkeypatch):
    session = build_session()
    campaign = Campaign(
        name='Teste seguro',
        message_template='Oi, {{nome}}',
        status='ready',
        test_completed_at=None,
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    session.add_all(
        [
            Contact(
                campaign_id=campaign.id,
                name='Alice',
                phone_raw='81999990001',
                phone_e164='+5581999990001',
                email='a@teste.com',
                status='pending',
            ),
            Contact(
                campaign_id=campaign.id,
                name='Bob',
                phone_raw='81999990002',
                phone_e164='+5581999990002',
                email='b@teste.com',
                status='pending',
            ),
        ]
    )
    session.commit()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    fake_client = _BridgeTestClient()
    monkeypatch.setattr(main, 'WhatsAppClient', lambda: fake_client)
    main.app.dependency_overrides[main.get_db] = override_get_db
    try:
        client = TestClient(main.app)
        client.cookies.set('mass_sender_admin', main.APP_PASSWORD)

        response = client.post(f'/campaigns/{campaign.id}/test-run', data={'sample_size': 2})
        assert response.status_code == 200
        payload = response.json()
        assert payload['ok'] is True
        assert payload['sent'] == 2
        assert 'Painel WhatsApp' in payload['destination_note']

        assert len(fake_client.sent) == 2
        assert fake_client.sent[0][0] == '5581999998888'
        assert 'Contato original: Alice' in fake_client.sent[0][1]
        assert 'Contato original: Bob' in fake_client.sent[1][1]

        refreshed = session.query(Contact).filter(Contact.campaign_id == campaign.id).all()
        assert {item.status for item in refreshed} == {'pending'}

        session.refresh(campaign)
        assert campaign.test_completed_at is not None
    finally:
        main.app.dependency_overrides.clear()
