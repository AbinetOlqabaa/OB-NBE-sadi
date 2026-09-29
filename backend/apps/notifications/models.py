from django.db import models
from django.utils import timezone
import uuid

class Notification(models.Model):
    LEVEL_CHOICES = [
        ('INFO', 'Informational Notice'),
        ('SUCCESS', 'Success Confirmation'),
        ('WARNING', 'Warning / Action Required'),
        ('ERROR', 'Error / Critical Alert'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4)
    user_id = models.CharField(max_length=64, db_index=True)
    title = models.CharField(max_length=255)
    message = models.TextField()
    level = models.CharField(max_length=32, choices=LEVEL_CHOICES, default='INFO')
    read = models.BooleanField(default=False)
    action_url = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'

    def __str__(self):
        return f"[{self.level}] {self.title} for {self.user_id}"
