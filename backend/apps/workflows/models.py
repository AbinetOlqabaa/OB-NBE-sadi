from django.db import models
from django.utils import timezone
import uuid

class Submission(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Maker Draft'),
        ('PENDING_CHECKER', 'Submitted for Checker Review'),
        ('APPROVED', 'Checker Approved (Ready for NBE)'),
        ('REJECTED', 'Checker Rejected'),
        ('CORRECTION_REQUIRED', 'Correction Requested by Checker'),
        ('SENDING', 'Transmitting to NBE Gateway'),
        ('SENT', 'Successfully Delivered to NBE'),
        ('FAILED', 'Delivery Failed'),
    ]

    id = models.CharField(max_length=64, primary_key=True)
    report_key = models.CharField(max_length=64, db_index=True)
    period_year = models.IntegerField(default=2026)
    period_quarter = models.IntegerField(null=True, blank=True)
    period_month = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='DRAFT', db_index=True)
    version = models.IntegerField(default=1)

    maker_id = models.CharField(max_length=64)
    maker_name = models.CharField(max_length=255)
    maker_dept = models.CharField(max_length=255)

    checker_id = models.CharField(max_length=64, blank=True)
    checker_name = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    nbe_submission_id = models.CharField(max_length=128, blank=True)
    nbe_correlation_id = models.CharField(max_length=128, blank=True)
    nbe_response = models.JSONField(null=True, blank=True)

    values = models.JSONField(default=dict, blank=True)
    dynamic_rows = models.JSONField(default=dict, blank=True)
    validation_summary = models.JSONField(default=dict, blank=True)
    comments = models.JSONField(default=list, blank=True)
    snapshots = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Report Submission'
        verbose_name_plural = 'Report Submissions'

    def __str__(self):
        return f"{self.report_key} (v{self.version}) - {self.status} [{self.maker_name}]"
