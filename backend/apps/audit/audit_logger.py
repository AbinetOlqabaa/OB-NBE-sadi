import uuid
from django.utils import timezone
from .models import AuditLog

class AuditLogger:
    @staticmethod
    def log(
        action: str,
        actor_id: str = 'sys_user',
        actor_name: str = 'System User',
        actor_role: str = 'MAKER',
        entity_type: str = 'REGULATORY',
        entity_id: str = 'OB_SYSTEM',
        correlation_id: str = '',
        details: str = '',
        old_state = None,
        new_state = None
    ) -> AuditLog:
        log_id = f"aud_{uuid.uuid4().hex[:12]}"
        corr_id = correlation_id or f"corr_{int(timezone.now().timestamp() * 1000)}"

        entry = AuditLog.objects.create(
            id=log_id,
            timestamp=timezone.now(),
            actor_id=actor_id,
            actor_name=actor_name,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            correlation_id=corr_id,
            details=details,
            old_state=old_state,
            new_state=new_state,
            sync_status='SYNCED',
            persisted_at=timezone.now()
        )
        return entry
