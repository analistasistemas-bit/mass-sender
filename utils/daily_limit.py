from __future__ import annotations

from datetime import datetime


def reset_daily_counters_if_needed(campaign, now: datetime) -> bool:
    if campaign.last_send_date is None:
        campaign.last_send_date = now
        return False

    if campaign.last_send_date.date() == now.date():
        return False

    campaign.sent_today = 0
    campaign.last_send_date = now
    return True


def daily_limit_reached(campaign) -> bool:
    return bool(campaign.daily_limit > 0 and campaign.sent_today >= campaign.daily_limit)
