from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, require_roles
from app.db.models import Tenant, User
from app.db.session import get_db
from app.schemas.audit import AuditLogRead
from app.services import audit_service

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("", response_model=list[AuditLogRead])
async def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    resource_type: Literal["product", "inventory", "order", "member"] | None = None,
    tenant: Tenant = Depends(get_current_tenant),
    _user: User = Depends(require_roles("owner", "manager")),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await audit_service.list_entries(db, tenant.id, limit, resource_type)
