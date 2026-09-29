from django.db import models
from django.utils import timezone
import uuid

class GatewayScenario(models.Model):
    MODE_CHOICES = [
        ('SUCCESS', 'All Returns Validated & Accepted (200 OK)'),
        ('VALIDATION_ERROR', 'NBE Rejection - Cross-Item Validation Mismatch (422)'),
        ('AUTH_FAILURE', 'NBE BSD Portal Rejected - mTLS / Certificate Expired (401)'),
        ('TIMEOUT', 'NBE BSD Gateway Timeout (504)'),
        ('SERVER_ERROR', 'NBE Core Banking Ingestion Error (500)'),
        ('RANDOM_FLAKY', 'Intermittent Flaky Network Mode (Simulate Retries)'),
    ]

    mode = models.CharField(max_length=32, choices=MODE_CHOICES, default='SUCCESS')
    latency_ms = models.IntegerField(default=50)
    failure_message = models.TextField(blank=True, default='')
    flaky_failure_rate = models.FloatField(default=0.4)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Gateway Scenario'

    @classmethod
    def get_current(cls):
        scenario = cls.objects.first()
        if not scenario:
            scenario = cls.objects.create(mode='SUCCESS', latency_ms=50)
        return scenario

class NbeSubmissionRecord(models.Model):
    submission_id = models.CharField(max_length=128, primary_key=True)
    report_key = models.CharField(max_length=64, db_index=True)
    institution_code = models.CharField(max_length=32, default='0000013')
    correlation_id = models.CharField(max_length=128, blank=True)
    idempotency_key = models.CharField(max_length=128, blank=True, db_index=True)
    status = models.CharField(max_length=32, default='ACCEPTED')
    received_at = models.DateTimeField(default=timezone.now)
    payload = models.JSONField(default=dict)
    response_payload = models.JSONField(default=dict)

    class Meta:
        ordering = ['-received_at']

class GatewayAuditLog(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4)
    timestamp = models.DateTimeField(default=timezone.now)
    direction = models.CharField(max_length=16, default='INBOUND')
    endpoint = models.CharField(max_length=255, default='/api/v2/regulatory/gateway')
    status_code = models.IntegerField(default=200)
    correlation_id = models.CharField(max_length=128, blank=True)
    idempotency_key = models.CharField(max_length=128, blank=True)
    message = models.TextField()

    class Meta:
        ordering = ['-timestamp']
