from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: str
    event_type: str
    resource_type: str
    resource_id: str
    summary: str
    details: dict[str, Any]
    actor_email: str | None
    actor_name: str | None
    created_at: datetime
