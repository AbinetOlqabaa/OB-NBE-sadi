import uuid
from django.utils import timezone
from .models import Notification
from apps.accounts.models import UserAccount

class NotificationService:
    @staticmethod
    def notify_user(user_id: str, title: str, message: str, level: str = 'INFO', action_url: str = ''):
        return Notification.objects.create(
            id=f"notif_{uuid.uuid4().hex[:12]}",
            user_id=user_id,
            title=title,
            message=message,
            level=level,
            action_url=action_url,
            created_at=timezone.now()
        )

    @classmethod
    def notify_department_checkers(cls, department: str, report_key: str, submission_id: str, maker_name: str):
        checkers = UserAccount.objects.filter(role='CHECKER', department=department, status='ACTIVE')
        for checker in checkers:
            cls.notify_user(
                user_id=checker.id,
                title=f"Review Required: Return {report_key}",
                message=f"Maker {maker_name} submitted return {report_key} for 4-eyes compliance review.",
                level='WARNING',
                action_url=f"/submissions/{submission_id}"
            )
