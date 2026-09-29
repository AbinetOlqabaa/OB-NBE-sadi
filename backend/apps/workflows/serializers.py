from rest_framework import serializers
from .models import Submission

class SubmissionSerializer(serializers.ModelSerializer):
    reportKey = serializers.CharField(source='report_key')
    periodYear = serializers.IntegerField(source='period_year')
    periodQuarter = serializers.IntegerField(source='period_quarter', required=False, allow_null=True)
    periodMonth = serializers.IntegerField(source='period_month', required=False, allow_null=True)
    makerId = serializers.CharField(source='maker_id')
    makerName = serializers.CharField(source='maker_name')
    makerDept = serializers.CharField(source='maker_dept')
    checkerId = serializers.CharField(source='checker_id', required=False, allow_blank=True)
    checkerName = serializers.CharField(source='checker_name', required=False, allow_blank=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at')
    submittedAt = serializers.DateTimeField(source='submitted_at', required=False, allow_null=True)
    reviewedAt = serializers.DateTimeField(source='reviewed_at', required=False, allow_null=True)
    deliveredAt = serializers.DateTimeField(source='delivered_at', required=False, allow_null=True)
    nbeSubmissionId = serializers.CharField(source='nbe_submission_id', required=False, allow_blank=True)
    nbeCorrelationId = serializers.CharField(source='nbe_correlation_id', required=False, allow_blank=True)
    nbeResponse = serializers.JSONField(source='nbe_response', required=False, allow_null=True)
    dynamicRows = serializers.JSONField(source='dynamic_rows', required=False)
    validationSummary = serializers.JSONField(source='validation_summary', required=False)

    class Meta:
        model = Submission
        fields = [
            'id',
            'reportKey',
            'periodYear',
            'periodQuarter',
            'periodMonth',
            'status',
            'version',
            'makerId',
            'makerName',
            'makerDept',
            'checkerId',
            'checkerName',
            'createdAt',
            'updatedAt',
            'submittedAt',
            'reviewedAt',
            'deliveredAt',
            'nbeSubmissionId',
            'nbeCorrelationId',
            'nbeResponse',
            'values',
            'dynamicRows',
            'validationSummary',
            'comments',
            'snapshots',
        ]
