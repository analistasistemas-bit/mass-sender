from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Iterable, Optional

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models import Campaign, Contact, SendLog
from utils.csv_parser import parse_csv_bytes
from utils.phone import normalize_br_phone

ALLOWED_STATUSES = {'draft', 'ready', 'running', 'paused', 'cancelled', 'completed'}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def render_message(template: str, name: Optional[str]) -> str:
    safe_name = (name or '').strip() or 'cliente'
    return template.replace('{{nome}}', safe_name)


def create_campaign(db: Session, name: str) -> Campaign:
    campaign = Campaign(name=name.strip(), status='draft', message_template='Oi, {{nome}}')
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


def update_template(db: Session, campaign_id: int, message_template: str) -> Campaign:
    campaign = get_campaign_or_404(db, campaign_id)
    campaign.message_template = message_template
    if campaign.status == 'draft':
        campaign.status = 'ready'
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    log_event(db, campaign.id, None, 'campaign_state_change', f'template updated; status={campaign.status}')
    return campaign


def get_campaign_or_404(db: Session, campaign_id: int) -> Campaign:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise ValueError('Campanha não encontrada')
    return campaign


def upload_contacts(db: Session, campaign_id: int, payload: bytes) -> dict:
    campaign = get_campaign_or_404(db, campaign_id)
    parsed = parse_csv_bytes(payload)

    inserted = 0
    for row in parsed.rows:
        status = 'pending' if row.valid else 'invalid'

        contact = Contact(
            campaign_id=campaign.id,
            name=row.nome,
            phone_raw=row.telefone,
            phone_e164=row.phone_e164,
            email=row.email,
            status=status,
            error_message=row.error,
        )
        db.add(contact)
        try:
            db.commit()
            inserted += 1
        except IntegrityError:
            db.rollback()

    refresh_campaign_counters(db, campaign.id)
    db.commit()

    return {
        'summary': {
            'total': parsed.summary.total,
            'valid': parsed.summary.valid,
            'invalid': parsed.summary.invalid,
            'inserted': inserted,
            'duplicates_skipped': max(0, parsed.summary.total - inserted),
        }
    }


def add_manual_contact(db: Session, campaign_id: int, name: str, phone: str, email: str = '') -> dict:
    campaign = get_campaign_or_404(db, campaign_id)

    safe_name = (name or '').strip()
    safe_phone = (phone or '').strip()
    safe_email = (email or '').strip()

    if not safe_name:
        return {'ok': False, 'message': 'Informe o nome do cliente.'}
    if not safe_phone:
        return {'ok': False, 'message': 'Informe o telefone do cliente.'}

    ok, phone_e164, error = normalize_br_phone(safe_phone)
    if not ok or not phone_e164:
        return {'ok': False, 'message': error or 'Telefone inválido para o padrão do Brasil (+55).'}

    contact = Contact(
        campaign_id=campaign.id,
        name=safe_name,
        phone_raw=safe_phone,
        phone_e164=phone_e164,
        email=safe_email,
        status='pending',
        error_message=None,
    )
    db.add(contact)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {'ok': False, 'message': 'Este telefone já existe nesta campanha.'}

    refresh_campaign_counters(db, campaign.id)
    if campaign.status in {'draft', 'completed', 'cancelled'}:
        campaign.status = 'ready'
    if campaign.status == 'ready':
        campaign.finished_at = None
        if campaign.sent_count > 0 or campaign.failed_count > 0:
            campaign.started_at = None
    db.add(campaign)
    db.commit()
    db.refresh(contact)

    return {
        'ok': True,
        'contact': {
            'id': contact.id,
            'name': contact.name or '',
            'phone_raw': contact.phone_raw or '',
            'phone_e164': contact.phone_e164 or '',
            'email': contact.email or '',
            'status': contact.status or '',
        },
    }


def delete_contact_from_campaign(db: Session, campaign_id: int, contact_id: int) -> dict:
    campaign = get_campaign_or_404(db, campaign_id)
    if campaign.status not in {'draft', 'ready', 'paused'}:
        return {'ok': False, 'message': 'Nao pode remover contato com a campanha em envio ou finalizada.'}

    contact = db.get(Contact, contact_id)
    if contact is None or contact.campaign_id != campaign.id:
        return {'ok': False, 'message': 'Contato nao encontrado nesta campanha.'}

    db.delete(contact)
    db.flush()
    refresh_campaign_counters(db, campaign.id)
    db.commit()

    return {'ok': True, 'message': 'Contato removido da campanha com sucesso.'}


def refresh_campaign_counters(db: Session, campaign_id: int) -> None:
    campaign = get_campaign_or_404(db, campaign_id)

    total = db.scalar(select(func.count(Contact.id)).where(Contact.campaign_id == campaign_id)) or 0
    valid = db.scalar(select(func.count(Contact.id)).where(Contact.campaign_id == campaign_id, Contact.status != 'invalid')) or 0
    invalid = db.scalar(select(func.count(Contact.id)).where(Contact.campaign_id == campaign_id, Contact.status == 'invalid')) or 0
    sent = db.scalar(select(func.count(Contact.id)).where(Contact.campaign_id == campaign_id, Contact.status == 'sent')) or 0
    failed = db.scalar(select(func.count(Contact.id)).where(Contact.campaign_id == campaign_id, Contact.status == 'failed')) or 0
    pending = db.scalar(select(func.count(Contact.id)).where(Contact.campaign_id == campaign_id, Contact.status.in_(['pending', 'processing']))) or 0

    campaign.total_contacts = int(total)
    campaign.valid_contacts = int(valid)
    campaign.invalid_contacts = int(invalid)
    campaign.sent_count = int(sent)
    campaign.failed_count = int(failed)
    campaign.pending_count = int(pending)

    # Self-heal old inconsistent states: a completed/cancelled campaign cannot keep a pending queue.
    if campaign.pending_count > 0 and campaign.status in {'completed', 'cancelled'}:
        campaign.status = 'ready'
        campaign.finished_at = None
        if campaign.sent_count > 0 or campaign.failed_count > 0:
            campaign.started_at = None
    elif (
        campaign.pending_count == 0
        and campaign.status in {'ready', 'paused'}
        and (campaign.sent_count + campaign.failed_count) > 0
        and (campaign.sent_count + campaign.failed_count) >= campaign.valid_contacts
    ):
        campaign.status = 'completed'
        if campaign.finished_at is None:
            campaign.finished_at = now_utc()

    db.add(campaign)


def dry_run(db: Session, campaign_id: int) -> dict:
    campaign = get_campaign_or_404(db, campaign_id)
    refresh_campaign_counters(db, campaign.id)
    db.commit()
    db.refresh(campaign)

    sample_q = select(Contact).where(Contact.campaign_id == campaign.id, Contact.status == 'pending').limit(5)
    sample_contacts: Iterable[Contact] = db.scalars(sample_q).all()
    preview = [
        {
            'name': c.name,
            'phone': c.phone_e164,
            'message': render_message(campaign.message_template, c.name),
        }
        for c in sample_contacts
    ]

    eta_seconds = campaign.pending_count * 7
    if campaign.pending_count == 0:
        message = 'Não há contatos pendentes nesta campanha.'
        empty_reason = 'no_pending_contacts'
        if campaign.status == 'completed':
            message = 'Esta campanha já foi concluída. Use "Reiniciar campanha" para executar novamente.'
            empty_reason = 'campaign_completed'
    else:
        message = f'Esta ação não envia mensagens reais. Existem {campaign.pending_count} contatos prontos para envio.'
        empty_reason = None

    return {
        'ok': True,
        'message': message,
        'pending_count': campaign.pending_count,
        'summary': {
            'valid': campaign.valid_contacts,
            'invalid': campaign.invalid_contacts,
            'total': campaign.total_contacts,
        },
        'preview': preview,
        'estimated_seconds': eta_seconds,
        'empty_reason': empty_reason,
    }


def restart_campaign(db: Session, campaign_id: int, mode: str) -> tuple[bool, str, int, str]:
    campaign = get_campaign_or_404(db, campaign_id)
    normalized_mode = (mode or '').strip().lower()
    if normalized_mode not in {'all', 'failed'}:
        return False, 'Modo de reinício inválido', 0, campaign.status

    if normalized_mode == 'all':
        statuses_to_reset = {'sent', 'failed', 'processing'}
        success_message = 'Fila recriada para reenviar toda a campanha.'
    else:
        statuses_to_reset = {'failed', 'processing'}
        success_message = 'Fila recriada para reenviar só as falhas.'

    contacts = db.scalars(
        select(Contact).where(Contact.campaign_id == campaign.id, Contact.status.in_(statuses_to_reset))
    ).all()

    for contact in contacts:
        contact.status = 'pending'
        contact.error_message = None
        contact.attempt_count = 0
        contact.last_attempt_at = None
        contact.sent_at = None
        db.add(contact)

    campaign.status = 'ready'
    campaign.test_completed_at = None
    campaign.started_at = None
    campaign.finished_at = None
    db.add(campaign)
    refresh_campaign_counters(db, campaign.id)
    log_event(db, campaign.id, None, 'campaign_state_change', f'campaign restarted; mode={normalized_mode}; reset={len(contacts)}')
    db.commit()
    return True, success_message, len(contacts), campaign.status


def start_campaign(db: Session, campaign_id: int) -> tuple[bool, str]:
    campaign = get_campaign_or_404(db, campaign_id)
    refresh_campaign_counters(db, campaign.id)
    db.flush()

    if campaign.status not in {'ready', 'paused'}:
        return False, f'Campanha no status {campaign.status} não pode iniciar'

    already_executed = campaign.sent_count > 0 or campaign.failed_count > 0
    if campaign.is_test_required and campaign.test_completed_at is None and not already_executed:
        return False, 'Campanha exige o envio de uma amostra para seu WhatsApp antes do envio real'

    campaign.status = 'running'
    if campaign.started_at is None:
        campaign.started_at = now_utc()
    campaign.finished_at = None
    db.add(campaign)
    log_event(db, campaign.id, None, 'campaign_state_change', 'campaign running')
    db.commit()
    return True, 'Campanha iniciada'


def pause_campaign(db: Session, campaign_id: int) -> tuple[bool, str]:
    campaign = get_campaign_or_404(db, campaign_id)
    if campaign.status != 'running':
        return False, 'Apenas campanha running pode ser pausada'
    campaign.status = 'paused'
    db.add(campaign)
    log_event(db, campaign.id, None, 'campaign_state_change', 'campaign paused')
    db.commit()
    return True, 'Campanha pausada'


def resume_campaign(db: Session, campaign_id: int) -> tuple[bool, str]:
    campaign = get_campaign_or_404(db, campaign_id)
    if campaign.status != 'paused':
        return False, 'Apenas campanha paused pode ser retomada'
    campaign.status = 'running'
    db.add(campaign)
    log_event(db, campaign.id, None, 'campaign_state_change', 'campaign resumed')
    db.commit()
    return True, 'Campanha retomada'


def cancel_campaign(db: Session, campaign_id: int) -> tuple[bool, str]:
    campaign = get_campaign_or_404(db, campaign_id)
    if campaign.status in {'cancelled', 'completed'}:
        return False, 'Campanha já finalizada'
    campaign.status = 'cancelled'
    campaign.finished_at = now_utc()
    db.add(campaign)
    log_event(db, campaign.id, None, 'campaign_state_change', 'campaign cancelled')
    db.commit()
    return True, 'Campanha cancelada'


def finalize_if_done(db: Session, campaign_id: int) -> None:
    campaign = get_campaign_or_404(db, campaign_id)
    pending = db.scalar(
        select(func.count(Contact.id)).where(
            Contact.campaign_id == campaign.id,
            Contact.status.in_(['pending', 'processing']),
        )
    )
    if campaign.status == 'running' and (pending or 0) == 0:
        campaign.status = 'completed'
        campaign.finished_at = now_utc()
        db.add(campaign)
        log_event(db, campaign.id, None, 'campaign_state_change', 'campaign completed')


def log_event(
    db: Session,
    campaign_id: int,
    contact_id: Optional[int],
    event_type: str,
    payload_excerpt: Optional[str],
    http_status: Optional[int] = None,
    error_class: Optional[str] = None,
) -> None:
    item = SendLog(
        campaign_id=campaign_id,
        contact_id=contact_id,
        event_type=event_type,
        payload_excerpt=payload_excerpt,
        http_status=http_status,
        error_class=error_class,
    )
    db.add(item)


def export_failures_csv(db: Session, campaign_id: int) -> bytes:
    contacts = db.scalars(
        select(Contact).where(Contact.campaign_id == campaign_id, Contact.status.in_(['failed', 'invalid']))
    ).all()

    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(['nome', 'telefone_original', 'telefone_normalizado', 'email', 'status', 'erro', 'tentativas'])
    for c in contacts:
        writer.writerow([c.name, c.phone_raw, c.phone_e164 or '', c.email, c.status, c.error_message or '', c.attempt_count])
    return stream.getvalue().encode('utf-8')


def stats_payload(db: Session, campaign_id: int) -> dict:
    campaign = get_campaign_or_404(db, campaign_id)
    refresh_campaign_counters(db, campaign.id)
    db.commit()
    db.refresh(campaign)

    current_cycle_sent = 0
    current_cycle_failed = 0
    current_cycle_pending = campaign.pending_count
    if campaign.started_at:
        current_cycle_sent = int(
            db.scalar(
                select(func.count(Contact.id)).where(
                    Contact.campaign_id == campaign.id,
                    Contact.status == 'sent',
                    Contact.sent_at.is_not(None),
                    Contact.sent_at >= campaign.started_at,
                )
            )
            or 0
        )
        current_cycle_failed = int(
            db.scalar(
                select(func.count(Contact.id)).where(
                    Contact.campaign_id == campaign.id,
                    Contact.status == 'failed',
                    Contact.last_attempt_at.is_not(None),
                    Contact.last_attempt_at >= campaign.started_at,
                )
            )
            or 0
        )
    current_cycle_total = current_cycle_sent + current_cycle_failed + current_cycle_pending

    return {
        'campaign_id': campaign.id,
        'status': campaign.status,
        'sent': campaign.sent_count,
        'failed': campaign.failed_count,
        'pending': campaign.pending_count,
        'valid': campaign.valid_contacts,
        'invalid': campaign.invalid_contacts,
        'total': campaign.total_contacts,
        'test_completed_at': campaign.test_completed_at.isoformat() if campaign.test_completed_at else None,
        'started_at': campaign.started_at.isoformat() if campaign.started_at else None,
        'finished_at': campaign.finished_at.isoformat() if campaign.finished_at else None,
        'updated_at': campaign.updated_at.isoformat(),
        'current_cycle': {
            'sent': current_cycle_sent,
            'failed': current_cycle_failed,
            'pending': current_cycle_pending,
            'total': current_cycle_total,
        },
    }
