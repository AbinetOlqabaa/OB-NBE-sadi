from rest_framework import serializers
from .models import SimulatorScenario, SimulatorSubmission, SimulatorRequestLog

class SimulatorScenarioSerializer(serializers.ModelSerializer):
    latencyMs = serializers.IntegerField(source='latency_ms', required=False)
    flakyFailureRate = serializers.FloatField(source='flaky_failure_rate', required=False)
    failureMessage = serializers.CharField(source='failure_message', required=False, allow_blank=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = SimulatorScenario
        fields = [
            'mode',
            'latencyMs',
            'flakyFailureRate',
            'failureMessage',
            'updatedAt',
        ]


class SimulatorSubmissionSerializer(serializers.ModelSerializer):
    receiptNumber = serializers.CharField(source='receipt_number')
    reportKey = serializers.CharField(source='report_key')
    institutionCode = serializers.CharField(source='institution_code')
    finYear = serializers.IntegerField(source='fin_year')
    periodStart = serializers.CharField(source='period_start')
    periodEnd = serializers.CharField(source='period_end')
    idempotencyKey = serializers.CharField(source='idempotency_key')
    correlationId = serializers.CharField(source='correlation_id')
    validationErrors = serializers.JSONField(source='validation_errors')
    responsePayload = serializers.JSONField(source='response_payload')
    receivedAt = serializers.DateTimeField(source='received_at')

    class Meta:
        model = SimulatorSubmission
        fields = [
            'id',
            'receiptNumber',
            'reportKey',
            'institutionCode',
            'finYear',
            'periodStart',
            'periodEnd',
            'idempotencyKey',
            'correlationId',
            'status',
            'validationErrors',
            'payload',
            'headers',
            'responsePayload',
            'receivedAt',
        ]


class SimulatorRequestLogSerializer(serializers.ModelSerializer):
    statusCode = serializers.IntegerField(source='status_code')
    statusText = serializers.CharField(source='status_text')
    returnKey = serializers.CharField(source='return_key')
    institutionCode = serializers.CharField(source='institution_code')
    idempotencyKey = serializers.CharField(source='idempotency_key')
    correlationId = serializers.CharField(source='correlation_id')
    durationMs = serializers.IntegerField(source='duration_ms')
    requestHeaders = serializers.JSONField(source='request_headers')
    requestBody = serializers.JSONField(source='request_body')
    responseHeaders = serializers.JSONField(source='response_headers')
    responseBody = serializers.JSONField(source='response_body')
    tlsInfo = serializers.JSONField(source='tls_info')

    class Meta:
        model = SimulatorRequestLog
        fields = [
            'id',
            'timestamp',
            'method',
            'path',
            'statusCode',
            'statusText',
            'returnKey',
            'institutionCode',
            'idempotencyKey',
            'correlationId',
            'message',
            'durationMs',
            'requestHeaders',
            'requestBody',
            'responseHeaders',
            'responseBody',
            'tlsInfo',
        ]
