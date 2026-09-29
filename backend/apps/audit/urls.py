from django.urls import path
from .views import (
    AuditLogListView,
    BiometricAuditLogView,
    AuditBatchSyncView,
    AuditorWorkQueueView,
    AuditFindingsView,
    AuditFindingDetailView,
    AuditEvidenceView,
    AuditNotesView,
    RemediationTrackingView,
    AuditReportExportView,
)

urlpatterns = [
    path('audit-logs', AuditLogListView.as_view(), name='audit-logs-list'),
    path('audit-logs/biometric', BiometricAuditLogView.as_view(), name='audit-logs-biometric'),
    path('audit-logs/batch', AuditBatchSyncView.as_view(), name='audit-logs-batch'),
    # First-class Auditor Workflows
    path('work-queue', AuditorWorkQueueView.as_view(), name='audit-work-queue'),
    path('findings', AuditFindingsView.as_view(), name='audit-findings-list'),
    path('findings/<str:pk>', AuditFindingDetailView.as_view(), name='audit-finding-detail'),
    path('evidence', AuditEvidenceView.as_view(), name='audit-evidence-list'),
    path('notes', AuditNotesView.as_view(), name='audit-notes-list'),
    path('remediations', RemediationTrackingView.as_view(), name='audit-remediations-list'),
    path('remediations/<str:pk>', RemediationTrackingView.as_view(), name='audit-remediation-detail'),
    path('reports/export', AuditReportExportView.as_view(), name='audit-reports-export'),
]
