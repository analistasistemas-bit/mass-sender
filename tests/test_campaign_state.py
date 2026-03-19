from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models import Campaign
from services.campaign_service import start_campaign


def build_session():
    engine = create_engine('sqlite:///:memory:', future=True)
    Session = sessionmaker(bind=engine, future=True)
    Base.metadata.create_all(engine)
    return Session()


def test_start_requires_test_run():
    session = build_session()
    campaign = Campaign(name='Lote 1', message_template='Oi {{nome}}', status='ready')
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    ok, message = start_campaign(session, campaign.id)
    assert ok is False
    assert 'teste' in message.lower()
