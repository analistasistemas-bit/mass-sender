from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CampaignCreate(BaseModel):
    name: str = Field(min_length=3, max_length=140)


class TemplateUpdate(BaseModel):
    message_template: str = Field(min_length=1, max_length=2000)


class CampaignStats(BaseModel):
    campaign_id: int
    status: str
    sent: int
    failed: int
    pending: int
    valid: int
    invalid: int
    total: int
    updated_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
