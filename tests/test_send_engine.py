from datetime import datetime, timedelta, timezone

import asyncio

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models import Campaign, Contact
from services import send_engine
from services.send_engine import processing_is_stale


def test_processing_is_stale_when_missing_timestamp():
    assert processing_is_stale(None) is True


def test_processing_is_stale_after_threshold():
    now = datetime(2026, 3, 18, 12, 0, tzinfo=timezone.utc)
    last_attempt = now - timedelta(minutes=3)
    assert processing_is_stale(last_attempt, now=now) is True


def test_processing_is_not_stale_before_threshold():
    now = datetime(2026, 3, 18, 12, 0, tzinfo=timezone.utc)
    last_attempt = now - timedelta(seconds=30)
    assert processing_is_stale(last_attempt, now=now) is False


def test_process_campaign_sends_without_detached_instance(monkeypatch):
    engine = create_engine('sqlite:///:memory:', future=True)
    Session = sessionmaker(bind=engine, future=True)
    Base.metadata.create_all(engine)

    session = Session()
    campaign = Campaign(name='Teste', message_template='Oi, {{nome}}', status='running', is_test_required=0)
    session.add(campaign)
    session.commit()
    session.refresh(campaign)
    campaign_id = campaign.id

    contact = Contact(
        campaign_id=campaign_id,
        name='Contato',
        phone_raw='11999998888',
        phone_e164='+5511999998888',
        email='contato@teste.com',
        status='pending',
    )
    session.add(contact)
    session.commit()
    contact_id = contact.id
    session.close()

    class FakeClient:
        async def send_text(self, phone_e164: str, text: str) -> None:
            assert phone_e164 == '+5511999998888'
            assert 'Contato' in text

    monkeypatch.setattr(send_engine, 'SessionLocal', Session)

    engine_worker = send_engine.SendEngine()
    engine_worker.client = FakeClient()

    asyncio.run(engine_worker._process_campaign(campaign_id))

    check = Session()
    saved = check.get(Contact, contact_id)
    assert saved.status == 'sent'
    assert saved.sent_at is not None
