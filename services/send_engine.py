from __future__ import annotations

import asyncio
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from database import SessionLocal
from models import Campaign, Contact
from services.campaign_service import finalize_if_done, log_event, refresh_campaign_counters, render_message
from services.whatsapp import WhatsAppClient, WhatsAppError


def processing_is_stale(last_attempt_at: datetime | None, now: datetime | None = None) -> bool:
    if last_attempt_at is None:
        return True

    current = now or datetime.now(timezone.utc)
    value = last_attempt_at
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return current - value > timedelta(minutes=2)


class SendEngine:
    def __init__(self) -> None:
        self._stop = asyncio.Event()
        self._locks: set[int] = set()
        self._profiles: dict[int, dict] = {}
        self.client = WhatsAppClient()

    async def run_forever(self) -> None:
        while not self._stop.is_set():
            await self._run_once()
            await asyncio.sleep(1.0)

    async def _run_once(self) -> None:
        with SessionLocal() as db:
            running_campaigns = db.scalars(select(Campaign).where(Campaign.status == 'running')).all()
            ids = [c.id for c in running_campaigns if c.id not in self._locks]

        tasks = [asyncio.create_task(self._process_campaign(campaign_id)) for campaign_id in ids]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _process_campaign(self, campaign_id: int) -> None:
        self._locks.add(campaign_id)
        profile = self._profiles.setdefault(campaign_id, {'batch_size': 10, 'ok_streak': 0, 'err_streak': 0})

        try:
            with SessionLocal() as db:
                campaign = db.get(Campaign, campaign_id)
                if campaign is None or campaign.status != 'running':
                    return

                stuck_contacts = db.scalars(
                    select(Contact).where(Contact.campaign_id == campaign_id, Contact.status == 'processing')
                ).all()
                recovered = False
                for contact in stuck_contacts:
                    if processing_is_stale(contact.last_attempt_at):
                        contact.status = 'pending'
                        db.add(contact)
                        recovered = True
                if recovered:
                    db.commit()

                contacts = db.scalars(
                    select(Contact)
                    .where(Contact.campaign_id == campaign_id, Contact.status == 'pending')
                    .limit(profile['batch_size'])
                ).all()

                contact_ids = [contact.id for contact in contacts]
                for contact in contacts:
                    contact.status = 'processing'
                    db.add(contact)
                db.commit()

            if not contact_ids:
                with SessionLocal() as db:
                    finalize_if_done(db, campaign_id)
                    refresh_campaign_counters(db, campaign_id)
                    db.commit()
                await asyncio.sleep(1)
                return

            sent_in_batch = 0
            failed_in_batch = 0
            for contact_id in contact_ids:
                result = await self._send_single(campaign_id, contact_id)
                if result:
                    sent_in_batch += 1
                else:
                    failed_in_batch += 1
                await asyncio.sleep(random.uniform(4, 9))

            if failed_in_batch == 0:
                profile['ok_streak'] += 1
                profile['err_streak'] = 0
                if profile['ok_streak'] >= 3 and profile['batch_size'] < 25:
                    profile['batch_size'] += 2
                    profile['ok_streak'] = 0
            else:
                profile['err_streak'] += 1
                profile['ok_streak'] = 0
                if profile['err_streak'] >= 2:
                    profile['batch_size'] = max(5, profile['batch_size'] - 2)

            await asyncio.sleep(random.uniform(25, 40))
        finally:
            self._locks.discard(campaign_id)

    async def _send_single(self, campaign_id: int, contact_id: int) -> bool:
        with SessionLocal() as db:
            campaign = db.get(Campaign, campaign_id)
            contact = db.get(Contact, contact_id)
            if campaign is None or contact is None:
                return False
            if campaign.status != 'running':
                contact.status = 'pending'
                db.add(contact)
                db.commit()
                return False

            contact.attempt_count += 1
            contact.last_attempt_at = datetime.now(timezone.utc)
            message = render_message(campaign.message_template, contact.name)
            log_event(db, campaign_id, contact.id, 'send_attempt', message[:160])
            db.commit()

        try:
            with SessionLocal() as db:
                contact = db.get(Contact, contact_id)
                if contact is None:
                    return False
                await self.client.send_text(contact.phone_e164 or '', message)
                contact.status = 'sent'
                contact.sent_at = datetime.now(timezone.utc)
                contact.error_message = None
                db.add(contact)
                log_event(db, campaign_id, contact.id, 'send_success', 'delivered')
                refresh_campaign_counters(db, campaign_id)
                db.commit()
            return True
        except WhatsAppError as exc:
            with SessionLocal() as db:
                contact = db.get(Contact, contact_id)
                if contact is None:
                    return False

                max_attempts = 3
                temporary = exc.error_class == 'temporary'
                if temporary and contact.attempt_count < max_attempts:
                    contact.status = 'pending'
                    contact.error_message = f'Temporário: {str(exc)[:200]}'
                    log_event(db, campaign_id, contact.id, 'retry_scheduled', contact.error_message, exc.http_status, exc.error_class)
                else:
                    contact.status = 'failed'
                    contact.error_message = str(exc)[:200]
                    log_event(db, campaign_id, contact.id, 'send_failure', contact.error_message, exc.http_status, exc.error_class)

                db.add(contact)
                refresh_campaign_counters(db, campaign_id)
                db.commit()
            return False

    async def stop(self) -> None:
        self._stop.set()
