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


def _friendly_failure_reason(reason: Optional[str]) -> str:
    text = (reason or '').strip()
    lowered = text.lower()
    mapping = {
        'number_resolution_failed': 'Numero nao disponivel no WhatsApp',
        'bridge_unreachable': 'Sistema de envio indisponivel',
        'temporary': 'Falha temporaria',
        'permanent': 'Falha permanente',
    }
    for key, label in mapping.items():
        if key in lowered:
            return label
    if not text:
        return 'Falha sem detalhe'
    return text[:90]


def _friendly_event_title(event_type: str) -> str:
    mapping = {
        'campaign_state_change': 'Mudanca de estado',
        'retry_scheduled': 'Nova tentativa agendada',
        'send_failure': 'Falha de envio',
        'send_success': 'Envio concluido',
        'send_attempt': 'Tentativa de envio',
    }
    return mapping.get(event_type, event_type.replace('_', ' ').capitalize())


def _friendly_event_summary(log: SendLog) -> str:
    if log.event_type == 'campaign_state_change':
        text = (log.payload_excerpt or '').strip()
        if not text:
            return 'Campanha atualizada.'
        return text[:140]
    if log.event_type == 'retry_scheduled':
        return 'Houve uma falha temporaria e o sistema programou nova tentativa.'
    if log.event_type == 'send_failure':
        return _friendly_failure_reason(log.payload_excerpt)
    if log.event_type == 'send_success':
        return 'Mensagem entregue com sucesso.'
    return (log.payload_excerpt or 'Sem detalhes adicionais.')[:140]


def _activity_tone(event_type: str) -> str:
    if event_type == 'send_failure':
        return 'error'
    if event_type == 'retry_scheduled':
        return 'warn'
    if event_type == 'send_success':
        return 'success'
    return 'info'


def _campaign_milestone_from_state(payload_excerpt: Optional[str]) -> Optional[dict]:
    text = (payload_excerpt or '').strip().lower()
    mapping = [
        ('campaign completed', {'title': 'Campanha concluida', 'summary': 'A campanha terminou e encerrou a fila atual.', 'tone': 'success'}),
        ('campaign resumed', {'title': 'Campanha retomada', 'summary': 'O envio voltou a processar a fila a partir do ponto de pausa.', 'tone': 'info'}),
        ('campaign paused', {'title': 'Campanha pausada', 'summary': 'A operacao foi interrompida temporariamente pelo operador.', 'tone': 'warn'}),
        ('campaign cancelled', {'title': 'Campanha cancelada', 'summary': 'A fila foi interrompida antes da conclusao.', 'tone': 'error'}),
        ('campaign running', {'title': 'Campanha iniciada', 'summary': 'O envio real foi liberado e a campanha entrou em execucao.', 'tone': 'info'}),
        ('campaign restarted', {'title': 'Campanha reiniciada', 'summary': 'A fila foi recriada para uma nova tentativa operacional.', 'tone': 'warn'}),
    ]
    for key, item in mapping:
        if key in text:
            return item
    return None


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


def build_results_payload(db: Session, campaign_id: int) -> dict:
    campaign = get_campaign_or_404(db, campaign_id)
    refresh_campaign_counters(db, campaign.id)
    db.flush()

    processed = int(campaign.sent_count + campaign.failed_count)
    success_rate = round((campaign.sent_count / processed) * 100, 1) if processed else 0.0
    failure_rate = round((campaign.failed_count / processed) * 100, 1) if processed else 0.0
    coverage_rate = round((processed / campaign.valid_contacts) * 100, 1) if campaign.valid_contacts else 0.0

    duration_seconds = 0
    if campaign.started_at:
        end_at = campaign.finished_at or now_utc()
        duration_seconds = max(0, int((end_at - campaign.started_at).total_seconds()))

    failure_rows = db.execute(
        select(Contact.error_message, func.count(Contact.id))
        .where(Contact.campaign_id == campaign.id, Contact.status.in_(['failed', 'invalid']))
        .group_by(Contact.error_message)
        .order_by(func.count(Contact.id).desc())
        .limit(4)
    ).all()
    top_failures = [
        {
            'label': _friendly_failure_reason(message),
            'count': int(count or 0),
            'tone': 'error' if 'invalid' not in str(message or '').lower() else 'warn',
        }
        for message, count in failure_rows
    ]

    if campaign.status == 'completed':
        headline = 'Campanha concluida'
        summary = (
            'Resultado final sem incidentes relevantes.'
            if campaign.failed_count == 0
            else 'A campanha terminou, mas houve contatos com falha que pedem revisao.'
        )
    elif campaign.status == 'running':
        headline = 'Campanha em andamento'
        summary = 'A execucao segue ativa. Use esta secao para acompanhar cobertura e falhas sem abrir os detalhes tecnicos.'
    elif campaign.pending_count > 0 and processed > 0:
        headline = 'Fila reaberta'
        summary = 'Os contatos ja processados permanecem no historico, enquanto a nova fila aguarda o proximo envio.'
    else:
        headline = 'Resultados parciais'
        summary = 'Os indicadores abaixo ajudam a decidir o proximo passo da operacao.'

    return {
        'headline': headline,
        'summary': summary,
        'processed': processed,
        'success_rate': success_rate,
        'failure_rate': failure_rate,
        'coverage_rate': coverage_rate,
        'duration_seconds': duration_seconds,
        'distribution': {
            'sent': int(campaign.sent_count),
            'failed': int(campaign.failed_count),
            'pending': int(campaign.pending_count),
            'invalid': int(campaign.invalid_contacts),
            'valid': int(campaign.valid_contacts),
            'total': int(campaign.total_contacts),
        },
        'top_failures': top_failures,
        'started_at': campaign.started_at.isoformat() if campaign.started_at else None,
        'finished_at': campaign.finished_at.isoformat() if campaign.finished_at else None,
    }


def build_activity_payload(db: Session, campaign_id: int) -> dict:
    campaign = get_campaign_or_404(db, campaign_id)
    refresh_campaign_counters(db, campaign.id)
    db.flush()

    grouped_rows = db.execute(
        select(SendLog.event_type, func.count(SendLog.id))
        .where(SendLog.campaign_id == campaign_id)
        .group_by(SendLog.event_type)
    ).all()
    event_counts = {event_type: int(count or 0) for event_type, count in grouped_rows}
    total_events = int(sum(event_counts.values()))

    summary_cards = [
        {'key': 'state', 'label': 'Mudancas de estado', 'count': int(event_counts.get('campaign_state_change', 0)), 'tone': 'info'},
        {'key': 'success', 'label': 'Entregas confirmadas', 'count': int(event_counts.get('send_success', 0)), 'tone': 'success'},
        {'key': 'retry', 'label': 'Novas tentativas', 'count': int(event_counts.get('retry_scheduled', 0)), 'tone': 'warn'},
        {'key': 'failure', 'label': 'Falhas tecnicas', 'count': int(event_counts.get('send_failure', 0)), 'tone': 'error'},
    ]

    milestone_logs = db.scalars(
        select(SendLog)
        .where(SendLog.campaign_id == campaign_id, SendLog.event_type == 'campaign_state_change')
        .order_by(SendLog.created_at.desc())
        .limit(20)
    ).all()
    milestones = []
    seen_titles = set()
    for log in milestone_logs:
        milestone = _campaign_milestone_from_state(log.payload_excerpt)
        if milestone is None or milestone['title'] in seen_titles:
            continue
        seen_titles.add(milestone['title'])
        milestones.append(
            {
                'title': milestone['title'],
                'summary': milestone['summary'],
                'time': log.created_at.isoformat(),
                'tone': milestone['tone'],
            }
        )

    incident_rows = db.execute(
        select(
            SendLog.event_type,
            SendLog.payload_excerpt,
            SendLog.error_class,
            SendLog.http_status,
            func.count(SendLog.id),
            func.max(SendLog.created_at),
        )
        .where(SendLog.campaign_id == campaign_id, SendLog.event_type.in_(['send_failure', 'retry_scheduled']))
        .group_by(SendLog.event_type, SendLog.payload_excerpt, SendLog.error_class, SendLog.http_status)
        .order_by(func.count(SendLog.id).desc(), func.max(SendLog.created_at).desc())
        .limit(8)
    ).all()
    incidents = [
        {
            'title': _friendly_event_title(event_type),
            'summary': _friendly_failure_reason(payload_excerpt),
            'tone': _activity_tone(event_type),
            'count': int(count or 0),
            'time': latest_at.isoformat(),
            'error_class': error_class or '-',
            'http_status': http_status or '-',
        }
        for event_type, payload_excerpt, error_class, http_status, count, latest_at in incident_rows
    ]

    processed_count = int(event_counts.get('send_success', 0) + event_counts.get('send_failure', 0))
    batch_size = 1000 if processed_count >= 1000 else 500 if processed_count >= 500 else 0
    if batch_size:
        processed_marker = (processed_count // batch_size) * batch_size
        processed_at = db.scalar(
            select(func.max(SendLog.created_at)).where(
                SendLog.campaign_id == campaign_id,
                SendLog.event_type.in_(['send_success', 'send_failure']),
            )
        )
        if processed_at is not None and processed_marker > 0:
            milestones.append(
                {
                    'title': 'Lote processado',
                    'summary': f'Lote de {processed_marker:,} contatos processado.'.replace(',', '.'),
                    'time': processed_at.isoformat(),
                    'tone': 'success',
                }
            )

    failed_count = int(event_counts.get('send_failure', 0))
    if failed_count >= 10:
        failure_peak_at = db.scalar(
            select(func.max(SendLog.created_at)).where(
                SendLog.campaign_id == campaign_id,
                SendLog.event_type == 'send_failure',
            )
        )
        if failure_peak_at is not None:
            milestones.append(
                {
                    'title': 'Pico de falhas',
                    'summary': f'{failed_count} falhas acumuladas pedem revisao operacional.',
                    'time': failure_peak_at.isoformat(),
                    'tone': 'error',
                }
            )

    milestones = sorted(milestones, key=lambda item: item['time'], reverse=True)[:6]

    return {
        'total_events': total_events,
        'summary_cards': summary_cards,
        'milestones': milestones,
        'incidents': incidents,
    }


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
