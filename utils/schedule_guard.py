from __future__ import annotations

from datetime import datetime, timedelta

SEND_HOUR_START = 8
SEND_HOUR_END = 20


def within_send_window(now: datetime) -> bool:
    return SEND_HOUR_START <= now.hour < SEND_HOUR_END


def seconds_until_next_window(now: datetime) -> int:
    if within_send_window(now):
        return 0
    if now.hour >= SEND_HOUR_END:
        next_window = (now + timedelta(days=1)).replace(hour=SEND_HOUR_START, minute=0, second=0, microsecond=0)
    else:
        next_window = now.replace(hour=SEND_HOUR_START, minute=0, second=0, microsecond=0)
    return max(1, int((next_window - now).total_seconds()))
