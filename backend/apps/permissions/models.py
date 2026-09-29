from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid

class SpecialAccessGrant(models.Model):
    """
    Formal, audited delegation granting cross-department or emergency
    access to a Maker or Checker for specific regulatory returns.
    """
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='special_access_grants'
    )
    report_key = models.CharField(max_length=64, blank=True, db_index=True)
    department = models.CharField(max_length=255, blank=True)
    departments = models.JSONField(default=list, blank=True)
    reason = models.TextField()
    granted_by = models.CharField(max_length=255)
    granted_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked = models.BooleanField(default=False)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-granted_at']
        verbose_name = 'Special Access Grant'
        verbose_name_plural = 'Special Access Grants'

    def is_active(self):
        if self.revoked:
            return False
        if self.expires_at and timezone.now() > self.expires_at:
            return False
        return True

    def covers_report(self, report_key, report_dept_name=None):
        if not self.is_active():
            return False
        if self.report_key and self.report_key == report_key:
            return True
        if self.department and report_dept_name and self.department.lower() == report_dept_name.lower():
            return True
        if self.departments and report_dept_name:
            if any(d.lower() == report_dept_name.lower() for d in self.departments):
                return True
        return False
