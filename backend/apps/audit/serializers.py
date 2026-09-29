from rest_framework import serializers
from .models import (
    AuditLog,
    AuditFinding,
    AuditEvidence,
    AuditWorkingNote,
    RemediationAction,
    AuditReportPackage
)

class AuditLogSerializer(serializers.ModelSerializer):
    actorId = serializers.CharField(source='actor_id')
    actorName = serializers.CharField(source='actor_name')
    actorRole = serializers.CharField(source='actor_role')
    entityType = serializers.CharField(source='entity_type')
    entityId = serializers.CharField(source='entity_id')
    correlationId = serializers.CharField(source='correlation_id', required=False, allow_blank=True)
    oldState = serializers.JSONField(source='old_state', required=False, allow_null=True)
    newState = serializers.JSONField(source='new_state', required=False, allow_null=True)
    syncStatus = serializers.CharField(source='sync_status', required=False)
    persistedAt = serializers.DateTimeField(source='persisted_at', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'timestamp',
            'actorId',
            'actorName',
            'actorRole',
            'action',
            'entityType',
            'entityId',
            'correlationId',
            'details',
            'oldState',
            'newState',
            'syncStatus',
            'persistedAt',
        ]


class AuditFindingSerializer(serializers.ModelSerializer):
    submissionId = serializers.CharField(source='submission_id')
    reportKey = serializers.CharField(source='report_key')
    regulatoryReference = serializers.CharField(source='regulatory_reference', required=False, allow_blank=True)
    affectedField = serializers.CharField(source='affected_field', required=False, allow_blank=True)
    financialVariance = serializers.DecimalField(source='financial_variance', max_digits=18, decimal_places=2, required=False, allow_null=True)
    auditorId = serializers.CharField(source='auditor_id')
    auditorName = serializers.CharField(source='auditor_name')
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = AuditFinding
        fields = [
            'id',
            'submissionId',
            'reportKey',
            'department',
            'title',
            'description',
            'severity',
            'status',
            'regulatoryReference',
            'affectedField',
            'financialVariance',
            'auditorId',
            'auditorName',
            'createdAt',
            'updatedAt',
        ]


class AuditEvidenceSerializer(serializers.ModelSerializer):
    submissionId = serializers.CharField(source='submission_id')
    reportKey = serializers.CharField(source='report_key')
    findingId = serializers.CharField(source='finding_id', required=False, allow_blank=True)
    fileName = serializers.CharField(source='file_name')
    fileType = serializers.CharField(source='file_type')
    fileSizeBytes = serializers.IntegerField(source='file_size_bytes', required=False)
    sha256Checksum = serializers.CharField(source='sha256_checksum')
    tamperSeal = serializers.CharField(source='tamper_seal', required=False, allow_blank=True)
    verificationStatus = serializers.CharField(source='verification_status', required=False)
    uploadedBy = serializers.CharField(source='uploaded_by')
    uploadedAt = serializers.DateTimeField(source='uploaded_at', read_only=True)

    class Meta:
        model = AuditEvidence
        fields = [
            'id',
            'submissionId',
            'reportKey',
            'findingId',
            'title',
            'fileName',
            'fileType',
            'fileSizeBytes',
            'sha256Checksum',
            'tamperSeal',
            'verificationStatus',
            'uploadedBy',
            'uploadedAt',
            'notes',
        ]


class AuditWorkingNoteSerializer(serializers.ModelSerializer):
    submissionId = serializers.CharField(source='submission_id')
    reportKey = serializers.CharField(source='report_key')
    authorId = serializers.CharField(source='author_id')
    authorName = serializers.CharField(source='author_name')
    isPrivate = serializers.BooleanField(source='is_private', default=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = AuditWorkingNote
        fields = [
            'id',
            'submissionId',
            'reportKey',
            'category',
            'authorId',
            'authorName',
            'content',
            'isPrivate',
            'createdAt',
        ]


class RemediationActionSerializer(serializers.ModelSerializer):
    findingId = serializers.CharField(source='finding_id')
    actionPlan = serializers.CharField(source='action_plan')
    assignedDepartment = serializers.CharField(source='assigned_department')
    assignedTo = serializers.CharField(source='assigned_to')
    targetDate = serializers.DateField(source='target_date')
    remediationProof = serializers.CharField(source='remediation_proof', required=False, allow_blank=True)
    verifiedBy = serializers.CharField(source='verified_by', required=False, allow_blank=True)
    verifiedAt = serializers.DateTimeField(source='verified_at', required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = RemediationAction
        fields = [
            'id',
            'findingId',
            'actionPlan',
            'assignedDepartment',
            'assignedTo',
            'targetDate',
            'status',
            'remediationProof',
            'verifiedBy',
            'verifiedAt',
            'createdAt',
        ]


class AuditReportPackageSerializer(serializers.ModelSerializer):
    scopeDepartments = serializers.JSONField(source='scope_departments')
    generatedBy = serializers.CharField(source='generated_by')
    findingsCount = serializers.IntegerField(source='findings_count', read_only=True)
    criticalCount = serializers.IntegerField(source='critical_count', read_only=True)
    highCount = serializers.IntegerField(source='high_count', read_only=True)
    executiveSummary = serializers.CharField(source='executive_summary')
    tamperSeal = serializers.CharField(source='tamper_seal', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = AuditReportPackage
        fields = [
            'id',
            'title',
            'period',
            'scopeDepartments',
            'generatedBy',
            'findingsCount',
            'criticalCount',
            'highCount',
            'executiveSummary',
            'tamperSeal',
            'createdAt',
        ]
