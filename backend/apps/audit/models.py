from django.db import models
from django.utils import timezone
import uuid

class AuditLog(models.Model):
    """
    Immutable compliance audit trail required by NBE Directive BSD/03/2020.
    Captures all security, authentication, workflow transitions, and regulatory submissions.
    """
    id = models.CharField(max_length=64, primary_key=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    actor_id = models.CharField(max_length=64)
    actor_name = models.CharField(max_length=255)
    actor_role = models.CharField(max_length=32)
    action = models.CharField(max_length=64, db_index=True)
    entity_type = models.CharField(max_length=64)
    entity_id = models.CharField(max_length=64)
    correlation_id = models.CharField(max_length=128, blank=True)
    details = models.TextField()
    old_state = models.JSONField(null=True, blank=True)
    new_state = models.JSONField(null=True, blank=True)
    sync_status = models.CharField(max_length=32, default='SYNCED')
    persisted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Compliance Audit Log'
        verbose_name_plural = 'Compliance Audit Logs'

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {self.action} by {self.actor_name} ({self.actor_role})"


class AuditFinding(models.Model):
    """
    Independent audit findings raised by Compliance Auditors during report inspection.
    Strict segregation: Auditors record findings; Makers/Checkers remediate.
    """
    SEVERITY_CHOICES = [
        ('CRITICAL', 'Critical Regulatory Non-Compliance'),
        ('HIGH', 'High Risk Material Discrepancy'),
        ('MEDIUM', 'Medium Variance / Policy Exception'),
        ('LOW', 'Low Severity Data Documentation Issue'),
        ('INFORMATIONAL', 'Informational / Process Improvement'),
    ]

    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('UNDER_REVIEW', 'Under Review'),
        ('REMEDIATION_PENDING', 'Remediation Pending'),
        ('RESOLVED', 'Resolved'),
        ('CLOSED', 'Closed'),
        ('ACCEPTED_RISK', 'Accepted Risk'),
    ]

    id = models.CharField(max_length=64, primary_key=True)
    submission_id = models.CharField(max_length=64, db_index=True)
    report_key = models.CharField(max_length=64, db_index=True)
    department = models.CharField(max_length=255)
    title = models.CharField(max_length=255)
    description = models.TextField()
    severity = models.CharField(max_length=32, choices=SEVERITY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='OPEN')
    regulatory_reference = models.CharField(max_length=255, blank=True)
    affected_field = models.CharField(max_length=128, blank=True)
    financial_variance = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    auditor_id = models.CharField(max_length=64)
    auditor_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Audit Finding'
        verbose_name_plural = 'Audit Findings'

    def __str__(self):
        return f"[{self.severity}] {self.title} ({self.status})"


class AuditEvidence(models.Model):
    """
    Documentary and technical evidence attached to audit investigations.
    Includes SHA-256 cryptographic checksums for tamper detection.
    """
    STATUS_CHOICES = [
        ('VERIFIED', 'Verified Integrity'),
        ('PENDING_REVIEW', 'Pending Review'),
        ('FLAGGED', 'Flagged / Tampered'),
    ]

    id = models.CharField(max_length=64, primary_key=True)
    submission_id = models.CharField(max_length=64, db_index=True)
    report_key = models.CharField(max_length=64)
    finding_id = models.CharField(max_length=64, blank=True)
    title = models.CharField(max_length=255)
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=64)
    file_size_bytes = models.PositiveIntegerField(default=0)
    sha256_checksum = models.CharField(max_length=64)
    tamper_seal = models.CharField(max_length=128, blank=True)
    verification_status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='VERIFIED')
    uploaded_by = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'Audit Evidence'
        verbose_name_plural = 'Audit Evidence Records'


class AuditWorkingNote(models.Model):
    """
    Confidential auditor working papers, notes, and inquiries.
    """
    CATEGORY_CHOICES = [
        ('OBSERVATION', 'Audit Observation'),
        ('METHODOLOGY', 'Testing Methodology'),
        ('RISK_NOTE', 'Risk Note'),
        ('INQUIRY', 'Management Inquiry'),
    ]

    id = models.CharField(max_length=64, primary_key=True)
    submission_id = models.CharField(max_length=64, db_index=True)
    report_key = models.CharField(max_length=64)
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, default='OBSERVATION')
    author_id = models.CharField(max_length=64)
    author_name = models.CharField(max_length=255)
    content = models.TextField()
    is_private = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Audit Working Note'
        verbose_name_plural = 'Audit Working Notes'


class RemediationAction(models.Model):
    """
    Remediation task tracking assigned to departments/makers for identified audit findings.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending Assignment'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed by Department'),
        ('OVERDUE', 'Overdue'),
        ('VERIFIED_BY_AUDITOR', 'Verified by Auditor'),
    ]

    id = models.CharField(max_length=64, primary_key=True)
    finding_id = models.CharField(max_length=64, db_index=True)
    action_plan = models.TextField()
    assigned_department = models.CharField(max_length=255)
    assigned_to = models.CharField(max_length=255)
    target_date = models.DateField()
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='PENDING')
    remediation_proof = models.TextField(blank=True)
    verified_by = models.CharField(max_length=255, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['target_date']
        verbose_name = 'Remediation Action'
        verbose_name_plural = 'Remediation Actions'


class AuditReportPackage(models.Model):
    """
    Formal compiled compliance and audit memorandum for executive management and NBE inspectors.
    """
    id = models.CharField(max_length=64, primary_key=True)
    title = models.CharField(max_length=255)
    period = models.CharField(max_length=64)
    scope_departments = models.JSONField(default=list)
    generated_by = models.CharField(max_length=255)
    findings_count = models.IntegerField(default=0)
    critical_count = models.IntegerField(default=0)
    high_count = models.IntegerField(default=0)
    executive_summary = models.TextField()
    tamper_seal = models.CharField(max_length=128)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Audit Report Package'
        verbose_name_plural = 'Audit Report Packages'
