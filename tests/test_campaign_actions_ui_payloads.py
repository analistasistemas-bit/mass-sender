from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models import Campaign, Contact
from services.campaign_service import add_manual_contact, delete_contact_from_campaign, dry_run, restart_campaign, start_campaign, stats_payload


def build_session():
    engine = create_engine('sqlite:///:memory:', future=True)
    Session = sessionmaker(bind=engine, future=True)
    Base.metadata.create_all(engine)
    return Session()


def test_dry_run_returns_friendly_empty_payload_for_completed_campaign():
    session = build_session()
    campaign = Campaign(name='Lote', message_template='Oi {{nome}}', status='completed')
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    payload = dry_run(session, campaign.id)

    assert payload['ok'] is True
    assert payload['pending_count'] == 0
    assert payload['empty_reason'] == 'campaign_completed'
    assert 'já foi concluída' in payload['message']
    assert payload['preview'] == []


def test_restart_campaign_all_resets_sent_failed_and_processing():
    session = build_session()
    campaign = Campaign(
        name='Reenvio',
        message_template='Oi, {{nome}}',
        status='completed',
        test_completed_at=datetime.now(timezone.utc),
        finished_at=datetime.now(timezone.utc),
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    rows = [
        Contact(campaign_id=campaign.id, name='Sent', phone_raw='1', phone_e164='+5511', email='a@a', status='sent', attempt_count=2, error_message='x', sent_at=datetime.now(timezone.utc), last_attempt_at=datetime.now(timezone.utc)),
        Contact(campaign_id=campaign.id, name='Failed', phone_raw='2', phone_e164='+5512', email='b@b', status='failed', attempt_count=1, error_message='boom', last_attempt_at=datetime.now(timezone.utc)),
        Contact(campaign_id=campaign.id, name='Processing', phone_raw='3', phone_e164='+5513', email='c@c', status='processing', attempt_count=1, error_message='wait', last_attempt_at=datetime.now(timezone.utc)),
        Contact(campaign_id=campaign.id, name='Invalid', phone_raw='4', phone_e164=None, email='d@d', status='invalid', error_message='bad'),
    ]
    session.add_all(rows)
    session.commit()

    ok, message, reset_contacts, new_status = restart_campaign(session, campaign.id, 'all')

    assert ok is True
    assert new_status == 'ready'
    assert reset_contacts == 3
    assert 'Fila recriada' in message

    refreshed = {c.name: c for c in session.query(Contact).filter(Contact.campaign_id == campaign.id).all()}
    assert refreshed['Sent'].status == 'pending'
    assert refreshed['Sent'].attempt_count == 0
    assert refreshed['Sent'].error_message is None
    assert refreshed['Sent'].sent_at is None
    assert refreshed['Failed'].status == 'pending'
    assert refreshed['Processing'].status == 'pending'
    assert refreshed['Invalid'].status == 'invalid'

    session.refresh(campaign)
    assert campaign.status == 'ready'
    assert campaign.test_completed_at is None
    assert campaign.started_at is None
    assert campaign.finished_at is None


def test_restart_campaign_failed_only_resets_failed_and_processing():
    session = build_session()
    campaign = Campaign(
        name='Reenvio',
        message_template='Oi, {{nome}}',
        status='completed',
        test_completed_at=datetime.now(timezone.utc),
        finished_at=datetime.now(timezone.utc),
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    rows = [
        Contact(campaign_id=campaign.id, name='Sent', phone_raw='1', phone_e164='+5511', email='a@a', status='sent', attempt_count=2, sent_at=datetime.now(timezone.utc)),
        Contact(campaign_id=campaign.id, name='Failed', phone_raw='2', phone_e164='+5512', email='b@b', status='failed', attempt_count=1, error_message='boom', last_attempt_at=datetime.now(timezone.utc)),
        Contact(campaign_id=campaign.id, name='Processing', phone_raw='3', phone_e164='+5513', email='c@c', status='processing', attempt_count=1, error_message='wait', last_attempt_at=datetime.now(timezone.utc)),
    ]
    session.add_all(rows)
    session.commit()

    ok, message, reset_contacts, new_status = restart_campaign(session, campaign.id, 'failed')

    assert ok is True
    assert new_status == 'ready'
    assert reset_contacts == 2
    assert 'falhas' in message.lower()

    refreshed = {c.name: c for c in session.query(Contact).filter(Contact.campaign_id == campaign.id).all()}
    assert refreshed['Sent'].status == 'sent'
    assert refreshed['Failed'].status == 'pending'
    assert refreshed['Processing'].status == 'pending'


def test_add_manual_contact_inserts_pending_contact_with_optional_email():
    session = build_session()
    campaign = Campaign(name='Manual', message_template='Oi {{nome}}', status='draft')
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    result = add_manual_contact(
        session,
        campaign.id,
        name='Cliente Manual',
        phone='(81) 99999-9999',
        email='',
    )

    assert result['ok'] is True
    assert result['contact']['name'] == 'Cliente Manual'
    assert result['contact']['phone_e164'] == '+5581999999999'
    assert result['contact']['email'] == ''

    inserted = session.query(Contact).filter(Contact.campaign_id == campaign.id).all()
    assert len(inserted) == 1
    assert inserted[0].status == 'pending'
    assert inserted[0].phone_e164 == '+5581999999999'


def test_add_manual_contact_rejects_invalid_phone():
    session = build_session()
    campaign = Campaign(name='Manual', message_template='Oi {{nome}}', status='draft')
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    result = add_manual_contact(
        session,
        campaign.id,
        name='Cliente Invalido',
        phone='1234',
        email='x@x.com',
    )

    assert result['ok'] is False
    assert 'Formato' in result['message'] or 'Telefone' in result['message']


def test_add_manual_contact_rejects_duplicate_phone_in_same_campaign():
    session = build_session()
    campaign = Campaign(name='Manual', message_template='Oi {{nome}}', status='draft')
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    first = add_manual_contact(
        session,
        campaign.id,
        name='Primeiro',
        phone='+55 81 99999-9999',
        email='a@a.com',
    )
    assert first['ok'] is True

    duplicate = add_manual_contact(
        session,
        campaign.id,
        name='Segundo',
        phone='81999999999',
        email='b@b.com',
    )

    assert duplicate['ok'] is False
    assert 'já existe' in duplicate['message'].lower()


def test_add_manual_contact_reopens_completed_campaign_to_ready():
    session = build_session()
    campaign = Campaign(
        name='Manual',
        message_template='Oi {{nome}}',
        status='completed',
        test_completed_at=datetime.now(timezone.utc),
        finished_at=datetime.now(timezone.utc),
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    result = add_manual_contact(
        session,
        campaign.id,
        name='Novo Cliente',
        phone='+55 81999999999',
        email='novo@cliente.com',
    )

    assert result['ok'] is True
    session.refresh(campaign)
    assert campaign.status == 'ready'
    assert campaign.finished_at is None


def test_stats_payload_reopens_completed_campaign_when_pending_exists():
    session = build_session()
    campaign = Campaign(
        name='Manual',
        message_template='Oi {{nome}}',
        status='completed',
        test_completed_at=datetime.now(timezone.utc),
        finished_at=datetime.now(timezone.utc),
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    session.add(
        Contact(
            campaign_id=campaign.id,
            name='Pendente antigo',
            phone_raw='+55 81999999997',
            phone_e164='+5581999999997',
            email='pendente@cliente.com',
            status='pending',
        )
    )
    session.commit()

    payload = stats_payload(session, campaign.id)

    session.refresh(campaign)
    assert payload['status'] == 'ready'
    assert payload['pending'] == 1
    assert campaign.status == 'ready'
    assert campaign.finished_at is None


def test_start_campaign_allows_reopened_queue_without_new_test_when_history_exists():
    session = build_session()
    campaign = Campaign(
        name='Manual',
        message_template='Oi {{nome}}',
        status='completed',
        finished_at=datetime.now(timezone.utc),
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    session.add_all(
        [
            Contact(
                campaign_id=campaign.id,
                name='Ja enviado',
                phone_raw='+55 81999999996',
                phone_e164='+5581999999996',
                email='sent@cliente.com',
                status='sent',
                sent_at=datetime.now(timezone.utc),
            ),
            Contact(
                campaign_id=campaign.id,
                name='Novo contato',
                phone_raw='+55 81999999995',
                phone_e164='+5581999999995',
                email='novo@cliente.com',
                status='pending',
            ),
        ]
    )
    session.commit()

    payload = stats_payload(session, campaign.id)
    assert payload['status'] == 'ready'

    ok, message = start_campaign(session, campaign.id)

    assert ok is True
    assert 'iniciada' in message.lower()


def test_stats_payload_exposes_current_cycle_metrics():
    session = build_session()
    started_at = datetime.now(timezone.utc)
    campaign = Campaign(
        name='Metrics',
        message_template='Oi {{nome}}',
        status='running',
        started_at=started_at,
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    session.add_all(
        [
            Contact(
                campaign_id=campaign.id,
                name='Historico antigo',
                phone_raw='+55 81999999994',
                phone_e164='+5581999999994',
                email='old@cliente.com',
                status='sent',
                sent_at=datetime.now(timezone.utc).replace(year=2025),
            ),
            Contact(
                campaign_id=campaign.id,
                name='Enviado atual',
                phone_raw='+55 81999999993',
                phone_e164='+5581999999993',
                email='new@cliente.com',
                status='sent',
                sent_at=started_at,
            ),
            Contact(
                campaign_id=campaign.id,
                name='Pendente atual',
                phone_raw='+55 81999999992',
                phone_e164='+5581999999992',
                email='pending@cliente.com',
                status='pending',
            ),
        ]
    )
    session.commit()

    payload = stats_payload(session, campaign.id)

    assert payload['current_cycle']['sent'] == 1
    assert payload['current_cycle']['pending'] == 1
    assert payload['current_cycle']['total'] == 2


def test_stats_payload_reconciles_ready_campaign_without_pending_back_to_completed():
    session = build_session()
    campaign = Campaign(
        name='Reconciliar',
        message_template='Oi {{nome}}',
        status='ready',
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    session.add_all(
        [
            Contact(
                campaign_id=campaign.id,
                name='Contato 1',
                phone_raw='+55 81999999990',
                phone_e164='+5581999999990',
                email='a@cliente.com',
                status='sent',
                sent_at=datetime.now(timezone.utc),
            ),
            Contact(
                campaign_id=campaign.id,
                name='Contato 2',
                phone_raw='+55 81999999991',
                phone_e164='+5581999999991',
                email='b@cliente.com',
                status='sent',
                sent_at=datetime.now(timezone.utc),
            ),
        ]
    )
    session.commit()

    payload = stats_payload(session, campaign.id)

    session.refresh(campaign)
    assert payload['status'] == 'completed'
    assert campaign.status == 'completed'
    assert campaign.finished_at is not None


def test_delete_contact_from_campaign_removes_contact_in_ready_status():
    session = build_session()
    campaign = Campaign(name='Excluir', message_template='Oi {{nome}}', status='ready')
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    contact = Contact(
        campaign_id=campaign.id,
        name='Contato Excluir',
        phone_raw='+55 81999999999',
        phone_e164='+5581999999999',
        email='x@x.com',
        status='pending',
    )
    session.add(contact)
    session.commit()
    session.refresh(contact)

    result = delete_contact_from_campaign(session, campaign.id, contact.id)

    assert result['ok'] is True
    assert 'removido' in result['message'].lower()
    assert session.get(Contact, contact.id) is None


def test_delete_contact_from_campaign_blocks_when_campaign_running():
    session = build_session()
    campaign = Campaign(name='Excluir', message_template='Oi {{nome}}', status='running')
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    contact = Contact(
        campaign_id=campaign.id,
        name='Contato Running',
        phone_raw='+55 81999999998',
        phone_e164='+5581999999998',
        email='x@x.com',
        status='pending',
    )
    session.add(contact)
    session.commit()
    session.refresh(contact)

    result = delete_contact_from_campaign(session, campaign.id, contact.id)

    assert result['ok'] is False
    assert 'nao pode remover' in result['message'].lower()
    assert session.get(Contact, contact.id) is not None
