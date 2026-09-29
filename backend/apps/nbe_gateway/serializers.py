from rest_framework import serializers
from .models import GatewayScenario, NbeSubmissionRecord, GatewayAuditLog

class GatewayScenarioSerializer(serializers.ModelSerializer):
    latencyMs = serializers.IntegerField(source='latency_ms')
    failureMessage = serializers.CharField(source='failure_message', required=False, allow_blank=True)
    flakyFailureRate = serializers.FloatField(source='flaky_failure_rate', required=False)

    class Meta:
        model = GatewayScenario
        fields = ['mode', 'latencyMs', 'failureMessage', 'flakyFailureRate']

class NbeSubmissionRecordSerializer(serializers.ModelSerializer):
    submissionId = serializers.CharField(source='submission_id')
    reportKey = serializers.CharField(source='report_key')
    institutionCode = serializers.CharField(source='institution_code')
    correlationId = serializers.CharField(source='correlation_id')
    idempotencyKey = serializers.CharField(source='idempotency_key')
    receivedAt = serializers.DateTimeField(source='received_at')

    class Meta:
        model = NbeSubmissionRecord
        fields = ['submissionId', 'reportKey', 'institutionCode', 'correlationId', 'idempotencyKey', 'status', 'receivedAt']

class GatewayAuditLogSerializer(serializers.ModelSerializer):
    statusCode = serializers.IntegerField(source='status_code')
    correlationId = serializers.CharField(source='correlation_id')
    idempotencyKey = serializers.CharField(source='idempotency_key')

    class Meta:
        model = GatewayAuditLog
        fields = ['id', 'timestamp', 'direction', 'endpoint', 'statusCode', 'correlationId', 'idempotencyKey', 'message']
