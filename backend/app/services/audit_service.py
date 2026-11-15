import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.timeutil import as_utc
from app.db import models


def record(
    db: AsyncSession,
    *,
    tenant_id: str,
    actor_user_id: str | None,
    event_type: str,
    resource_type: str,
    resource_id: str,
    summary: str,
    **details: Any,
) -> None:
    """Queue an audit entry on the current transaction.

    The caller owns the commit, so the entry is persisted atomically with the
    change it describes.
    """
    db.add(
        models.AuditLog(
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
            event_type=event_type,
            resource_type=resource_type,
            resource_id=resource_id,
            details=json.dumps({"summary": summary, **details}),
        )
    )


def _serialize(entry: models.AuditLog) -> dict:
    details: dict[str, Any] = {}
    if entry.details:
        try:
            details = json.loads(entry.details)
        except json.JSONDecodeError:
            details = {"summary": entry.details}

    summary = details.pop("summary", entry.event_type)
    actor = entry.actor_user
    return {
        "id": entry.id,
        "event_type": entry.event_type,
        "resource_type": entry.resource_type,
        "resource_id": entry.resource_id,
        "summary": summary,
        "details": details,
        "actor_email": actor.email if actor else None,
        "actor_name": actor.full_name if actor else None,
        "created_at": as_utc(entry.created_at),
    }


async def list_entries(
    db: AsyncSession,
    tenant_id: str,
    limit: int = 50,
    resource_type: str | None = None,
) -> list[dict]:
    stmt = (
        select(models.AuditLog)
        .options(selectinload(models.AuditLog.actor_user))
        .where(models.AuditLog.tenant_id == tenant_id)
        .order_by(models.AuditLog.created_at.desc(), models.AuditLog.id.desc())
        .limit(limit)
    )
    if resource_type:
        stmt = stmt.where(models.AuditLog.resource_type == resource_type)
    entries = (await db.scalars(stmt)).all()
    return [_serialize(entry) for entry in entries]
