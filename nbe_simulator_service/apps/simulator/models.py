import uuid
from django.db import models
from django.utils import timezone

class SimulatorScenario(models.Model):
    """
    Runtime behavior mode of the NBE Central Bank Intake Simulator.
    Supports 6 configurable scenarios required by 18_NBE_SIMULATOR_MICROSERVICE.md:
    1. ALWAYS_SUCCESS (HTTP 200/201, cryptographic receipt)
    2. VALIDATION_ERROR (HTTP 422, unprocessable return schema)
    3. AUTH_FAILURE (HTTP 401, mTLS token/cert failure)
    4. TIMEOUT (HTTP 504, artificial latency / gateway timeout)
    5. SERVER_ERROR (HTTP 500, central bank internal deadlock)
    6. RANDOM_FLAKY (intermittent failure rate & jitter)
    """
    MODE_CHOICES = [
        ('ALWAYS_SUCCESS', 'Always Success (200 OK + Cryptographic Receipt)'),
        ('VALIDATION_ERROR', 'Validation Error (422 Unprocessable Entity)'),
        ('AUTH_FAILURE', 'Mutual TLS / Auth Failure (401 Unauthorized)'),
        ('TIMEOUT', 'Gateway Timeout (504 Gateway Timeout)'),
        ('SERVER_ERROR', 'Central Bank Server Error (500 Internal Server Error)'),
        ('RANDOM_FLAKY', 'Random Flaky (Intermittent Network / Server Errors)'),
    ]

    mode = models.CharField(max_length=32, choices=MODE_CHOICES, default='ALWAYS_SUCCESS')
    latency_ms = models.IntegerField(default=150, help_text="Configured delay in milliseconds before responding")
    flaky_failure_rate = models.FloatField(default=0.30, help_text="Failure probability for RANDOM_FLAKY mode")
    failure_message = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Simulator Scenario'
        verbose_name_plural = 'Simulator Scenarios'

    @classmethod
    def get_current(cls):
        scenario = cls.objects.first()
        if not scenario:
            scenario = cls.objects.create(
                mode='ALWAYS_SUCCESS',
                latency_ms=150,
                flaky_failure_rate=0.30,
                failure_message=''
            )
        return scenario


class SimulatorSubmission(models.Model):
    """
    Official persistent log of statutory report submissions received by the NBE Intake Simulator.
    Preserves raw NBE payload structure and provides idempotency deduplication.
    """
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4)
    receipt_number = models.CharField(max_length=128, unique=True, db_index=True)
    report_key = models.CharField(max_length=64, db_index=True)
    institution_code = models.CharField(max_length=32, default='0000013')
    fin_year = models.IntegerField(default=2026)
    period_start = models.CharField(max_length=32, blank=True, default='')
    period_end = models.CharField(max_length=32, blank=True, default='')
    idempotency_key = models.CharField(max_length=128, blank=True, db_index=True)
    correlation_id = models.CharField(max_length=128, blank=True, db_index=True)
    status = models.CharField(max_length=32, default='ACCEPTED')  # ACCEPTED, REJECTED, DUPLICATE
    validation_errors = models.JSONField(default=list, blank=True)
    payload = models.JSONField(default=dict)
    headers = models.JSONField(default=dict)
    response_payload = models.JSONField(default=dict)
    received_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-received_at']
        verbose_name = 'Received Submission'
        verbose_name_plural = 'Received Submissions'


class SimulatorRequestLog(models.Model):
    """
    Audit log of all HTTP intake traffic received by the NBE Simulator.
    Captures headers, payloads, duration, mTLS emulation, and response status.
    """
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    method = models.CharField(max_length=16, default='POST')
    path = models.CharField(max_length=256)
    status_code = models.IntegerField(default=200)
    status_text = models.CharField(max_length=64, default='200 OK')
    return_key = models.CharField(max_length=64, blank=True, default='')
    institution_code = models.CharField(max_length=32, blank=True, default='0000013')
    idempotency_key = models.CharField(max_length=128, blank=True, default='')
    correlation_id = models.CharField(max_length=128, blank=True, default='')
    message = models.TextField(blank=True, default='')
    duration_ms = models.IntegerField(default=0)
    request_headers = models.JSONField(default=dict, blank=True)
    request_body = models.JSONField(default=dict, blank=True)
    response_headers = models.JSONField(default=dict, blank=True)
    response_body = models.JSONField(default=dict, blank=True)
    tls_info = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Simulator API Log'
        verbose_name_plural = 'Simulator API Logs'
