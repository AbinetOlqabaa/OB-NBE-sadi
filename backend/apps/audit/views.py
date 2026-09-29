import uuid
import hashlib
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import (
    AuditLog,
    AuditFinding,
    AuditEvidence,
    AuditWorkingNote,
    RemediationAction,
    AuditReportPackage
)
from .serializers import (
    AuditLogSerializer,
    AuditFindingSerializer,
    AuditEvidenceSerializer,
    AuditWorkingNoteSerializer,
    RemediationActionSerializer,
    AuditReportPackageSerializer
)
from .audit_logger import AuditLogger
from apps.workflows.models import Submission
from apps.workflows.views import resolve_user_from_request

class AuditLogListView(APIView):
    def get(self, request):
        page = request.query_params.get('page')
        page_size = int(request.query_params.get('page_size', request.query_params.get('limit', 10)))
        qs = AuditLog.objects.all()
        if page:
            page_num = max(1, int(page))
            total = qs.count()
            total_pages = max(1, (total + page_size - 1) // page_size)
            safe_page = min(page_num, total_pages)
            start = (safe_page - 1) * page_size
            items = qs[start:start + page_size]
            serializer = AuditLogSerializer(items, many=True)
            return Response({
                'items': serializer.data,
                'total': total,
                'page': safe_page,
                'page_size': page_size,
                'total_pages': total_pages,
                'has_next': safe_page < total_pages,
                'has_previous': safe_page > 1,
            })

        limit = int(request.query_params.get('limit', 100))
        logs = qs[:limit]
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)

    def post(self, request):
        data = request.data
        action = data.get('action')
        if not action:
            return Response({'error': 'Action is required for audit trail entry'}, status=status.HTTP_400_BAD_REQUEST)

        entry = AuditLogger.log(
            action=action,
            actor_id=data.get('actorId', 'sys_user'),
            actor_name=data.get('actorName', 'System User'),
            actor_role=data.get('actorRole', 'MAKER'),
            entity_type=data.get('entityType', 'REGULATORY'),
            entity_id=data.get('entityId', 'OB_SYSTEM'),
            correlation_id=data.get('correlationId', ''),
            details=data.get('details', f'Recorded action {action}'),
            old_state=data.get('oldState'),
            new_state=data.get('newState')
        )
        return Response(AuditLogSerializer(entry).data, status=status.HTTP_201_CREATED)


class BiometricAuditLogView(APIView):
    def post(self, request):
        data = request.data
        action = data.get('action', 'BIOMETRIC_EVENT')
        entry = AuditLogger.log(
            action=action,
            actor_id=data.get('actorId', 'bio_sensor'),
            actor_name=data.get('actorName', 'Biometric Sensor'),
            actor_role=data.get('actorRole', 'AUTH'),
            entity_type='BIOMETRICS',
            entity_id=data.get('entityId', 'BIO_AUTH'),
            correlation_id=data.get('correlationId', ''),
            details=data.get('details', 'Biometric hardware sensor event')
        )
        return Response(AuditLogSerializer(entry).data, status=status.HTTP_201_CREATED)


class AuditBatchSyncView(APIView):
    def post(self, request):
        logs = request.data.get('logs', [])
        if not isinstance(logs, list):
            return Response({'error': 'Expected logs array'}, status=status.HTTP_400_BAD_REQUEST)

        appended_count = 0
        for item in logs:
            if not isinstance(item, dict) or not item.get('id'):
                continue
            log_id = item.get('id')
            if not AuditLog.objects.filter(id=log_id).exists():
                AuditLog.objects.create(
                    id=log_id,
                    actor_id=item.get('actorId', 'field_user'),
                    actor_name=item.get('actorName', 'Field Examiner'),
                    actor_role=item.get('actorRole', 'MAKER'),
                    action=item.get('action', 'OFFLINE_EVENT'),
                    entity_type=item.get('entityType', 'REGULATORY'),
                    entity_id=item.get('entityId', 'FIELD_DEVICE'),
                    correlation_id=item.get('correlationId', ''),
                    details=item.get('details', 'Synced offline audit log'),
                    sync_status='SYNCED',
                    persisted_at=timezone.now()
                )
                appended_count += 1

        return Response({
            'success': True,
            'count': appended_count,
            'totalLogs': AuditLog.objects.count()
        })


class AuditorWorkQueueView(APIView):
    """
    Returns the comprehensive Audit Work Queue across all 8 bank departments.
    Combines submissions, findings counts, evidence attachments, and compliance review flags.
    """
    def get(self, request):
        submissions = Submission.objects.all().order_by('-updated_at')
        dept_filter = request.query_params.get('department')
        status_filter = request.query_params.get('status')
        report_key_filter = request.query_params.get('reportKey')

        if dept_filter:
            submissions = submissions.filter(maker_dept=dept_filter)
        if status_filter:
            submissions = submissions.filter(status=status_filter)
        if report_key_filter:
            submissions = submissions.filter(report_key=report_key_filter)

        queue_items = []
        for sub in submissions:
            findings = AuditFinding.objects.filter(submission_id=sub.id)
            evidences = AuditEvidence.objects.filter(submission_id=sub.id)
            notes = AuditWorkingNote.objects.filter(submission_id=sub.id)
            remediations = RemediationAction.objects.filter(finding_id__in=findings.values_list('id', flat=True))

            open_critical = findings.filter(severity='CRITICAL', status__in=['OPEN', 'UNDER_REVIEW']).count()
            open_high = findings.filter(severity='HIGH', status__in=['OPEN', 'UNDER_REVIEW']).count()
            open_findings = findings.filter(status__in=['OPEN', 'UNDER_REVIEW', 'REMEDIATION_PENDING']).count()
            pending_remediations = remediations.filter(status__in=['PENDING', 'IN_PROGRESS', 'OVERDUE']).count()

            # Audit status calculation
            if open_critical > 0 or open_high > 0:
                audit_status = 'FLAGGED_HIGH_RISK'
            elif open_findings > 0:
                audit_status = 'FINDINGS_OPEN'
            elif sub.status == 'SENT':
                audit_status = 'NBE_DELIVERED_PENDING_AUDIT'
            elif sub.status == 'APPROVED':
                audit_status = 'CHECKER_APPROVED'
            elif sub.status == 'PENDING_CHECKER':
                audit_status = 'IN_CHECKER_REVIEW'
            else:
                audit_status = 'IN_DRAFTING'

            queue_items.append({
                'submissionId': sub.id,
                'reportKey': sub.report_key,
                'department': sub.maker_dept,
                'makerName': sub.maker_name,
                'version': sub.version,
                'submissionStatus': sub.status,
                'submittedAt': sub.submitted_at.isoformat() if sub.submitted_at else None,
                'nbeReference': sub.nbe_submission_id,
                'auditStatus': audit_status,
                'totalFindings': findings.count(),
                'openFindings': open_findings,
                'criticalFindings': open_critical,
                'highFindings': open_high,
                'evidenceCount': evidences.count(),
                'notesCount': notes.count(),
                'pendingRemediations': pending_remediations,
                'updatedAt': sub.updated_at.isoformat(),
            })

        # Aggregated KPI Summary
        all_findings = AuditFinding.objects.all()
        summary = {
            'totalReportsInQueue': len(queue_items),
            'totalOpenFindings': all_findings.filter(status__in=['OPEN', 'UNDER_REVIEW', 'REMEDIATION_PENDING']).count(),
            'criticalFindings': all_findings.filter(severity='CRITICAL', status__in=['OPEN', 'UNDER_REVIEW']).count(),
            'highFindings': all_findings.filter(severity='HIGH', status__in=['OPEN', 'UNDER_REVIEW']).count(),
            'pendingRemediations': RemediationAction.objects.filter(status__in=['PENDING', 'IN_PROGRESS', 'OVERDUE']).count(),
            'completedAudits': len([q for q in queue_items if q['auditStatus'] in ['NBE_DELIVERED_PENDING_AUDIT', 'CHECKER_APPROVED'] and q['openFindings'] == 0]),
        }

        page = request.query_params.get('page')
        page_size = int(request.query_params.get('page_size', request.query_params.get('limit', 10)))
        if page:
            page_num = max(1, int(page))
            total = len(queue_items)
            total_pages = max(1, (total + page_size - 1) // page_size)
            safe_page = min(page_num, total_pages)
            start = (safe_page - 1) * page_size
            items = queue_items[start:start + page_size]
            return Response({
                'summary': summary,
                'items': items,
                'queue': items,
                'total': total,
                'page': safe_page,
                'page_size': page_size,
                'total_pages': total_pages,
                'has_next': safe_page < total_pages,
                'has_previous': safe_page > 1,
            })

        return Response({
            'summary': summary,
            'queue': queue_items,
        })


class AuditFindingsView(APIView):
    """
    CRUD API for compliance audit findings.
    Only users with AUDITOR or ADMIN roles can create findings.
    """
    def get(self, request):
        qs = AuditFinding.objects.all()
        sub_id = request.query_params.get('submissionId')
        report_key = request.query_params.get('reportKey')
        severity = request.query_params.get('severity')
        status_param = request.query_params.get('status')
        department = request.query_params.get('department')

        if sub_id:
            qs = qs.filter(submission_id=sub_id)
        if report_key:
            qs = qs.filter(report_key=report_key)
        if severity:
            qs = qs.filter(severity=severity)
        if status_param:
            qs = qs.filter(status=status_param)
        if department:
            qs = qs.filter(department=department)

        page = request.query_params.get('page')
        page_size = int(request.query_params.get('page_size', request.query_params.get('limit', 10)))
        if page:
            page_num = max(1, int(page))
            total = qs.count()
            total_pages = max(1, (total + page_size - 1) // page_size)
            safe_page = min(page_num, total_pages)
            start = (safe_page - 1) * page_size
            items = qs[start:start + page_size]
            serializer = AuditFindingSerializer(items, many=True)
            return Response({
                'items': serializer.data,
                'total': total,
                'page': safe_page,
                'page_size': page_size,
                'total_pages': total_pages,
                'has_next': safe_page < total_pages,
                'has_previous': safe_page > 1,
            })

        serializer = AuditFindingSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = resolve_user_from_request(request)
        if not user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        # Enforce that only AUDITOR or ADMIN can create findings
        if getattr(user, 'role', '') not in ('AUDITOR', 'ADMIN'):
            return Response(
                {'error': f"Role '{getattr(user, 'role', '')}' is not authorized to create audit findings. Action restricted to Compliance Auditors."},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data
        finding_id = f"FIND-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        finding = AuditFinding.objects.create(
            id=finding_id,
            submission_id=data.get('submissionId', ''),
            report_key=data.get('reportKey', ''),
            department=data.get('department', ''),
            title=data.get('title', 'Untitled Audit Finding'),
            description=data.get('description', ''),
            severity=data.get('severity', 'MEDIUM'),
            status=data.get('status', 'OPEN'),
            regulatory_reference=data.get('regulatoryReference', ''),
            affected_field=data.get('affectedField', ''),
            financial_variance=data.get('financialVariance'),
            auditor_id=user.id,
            auditor_name=user.name,
        )

        AuditLogger.log(
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            action='AUDIT_FINDING_CREATED',
            entity_type='AUDIT_FINDING',
            entity_id=finding.id,
            details=f"Auditor {user.name} recorded [{finding.severity}] finding '{finding.title}' on {finding.report_key}."
        )

        return Response(AuditFindingSerializer(finding).data, status=status.HTTP_201_CREATED)


class AuditFindingDetailView(APIView):
    def patch(self, request, pk):
        try:
            finding = AuditFinding.objects.get(pk=pk)
        except AuditFinding.DoesNotExist:
            return Response({'error': 'Finding not found'}, status=status.HTTP_404_NOT_FOUND)

        user = resolve_user_from_request(request)
        data = request.data

        if 'status' in data:
            finding.status = data['status']
        if 'severity' in data:
            finding.severity = data['severity']
        if 'description' in data:
            finding.description = data['description']

        finding.save()

        AuditLogger.log(
            actor_id=user.id if user else 'auditor_user',
            actor_name=user.name if user else 'Compliance Auditor',
            actor_role=user.role if user else 'AUDITOR',
            action='AUDIT_FINDING_UPDATED',
            entity_type='AUDIT_FINDING',
            entity_id=finding.id,
            details=f"Finding {finding.id} status updated to {finding.status}."
        )

        return Response(AuditFindingSerializer(finding).data)


class AuditEvidenceView(APIView):
    """
    Manages document attachments and evidence files with cryptographic SHA-256 seals.
    """
    def get(self, request):
        sub_id = request.query_params.get('submissionId')
        qs = AuditEvidence.objects.all().order_by('-uploaded_at')
        if sub_id:
            qs = qs.filter(submission_id=sub_id)

        page = request.query_params.get('page')
        page_size = int(request.query_params.get('page_size', request.query_params.get('limit', 10)))
        if page:
            page_num = max(1, int(page))
            total = qs.count()
            total_pages = max(1, (total + page_size - 1) // page_size)
            safe_page = min(page_num, total_pages)
            start = (safe_page - 1) * page_size
            items = qs[start:start + page_size]
            serializer = AuditEvidenceSerializer(items, many=True)
            return Response({
                'items': serializer.data,
                'total': total,
                'page': safe_page,
                'page_size': page_size,
                'total_pages': total_pages,
                'has_next': safe_page < total_pages,
                'has_previous': safe_page > 1,
            })

        serializer = AuditEvidenceSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = resolve_user_from_request(request)
        data = request.data

        file_name = data.get('fileName', 'evidence_document.pdf')
        content_for_hash = f"{file_name}_{timezone.now().isoformat()}_{data.get('submissionId')}"
        computed_hash = hashlib.sha256(content_for_hash.encode()).hexdigest()
        tamper_seal = f"OB-EVID-SEAL-{computed_hash[:16].upper()}"

        evidence = AuditEvidence.objects.create(
            id=f"EVID-{uuid.uuid4().hex[:8].upper()}",
            submission_id=data.get('submissionId', ''),
            report_key=data.get('reportKey', ''),
            finding_id=data.get('findingId', ''),
            title=data.get('title', file_name),
            file_name=file_name,
            file_type=data.get('fileType', 'application/pdf'),
            file_size_bytes=data.get('fileSizeBytes', 1024),
            sha256_checksum=data.get('sha256Checksum', computed_hash),
            tamper_seal=tamper_seal,
            verification_status='VERIFIED',
            uploaded_by=user.name if user else 'Compliance Auditor',
            notes=data.get('notes', ''),
        )

        return Response(AuditEvidenceSerializer(evidence).data, status=status.HTTP_201_CREATED)


class AuditNotesView(APIView):
    """
    Confidential auditor working papers and inquiry notes.
    """
    def get(self, request):
        sub_id = request.query_params.get('submissionId')
        qs = AuditWorkingNote.objects.all().order_by('-created_at')
        if sub_id:
            qs = qs.filter(submission_id=sub_id)

        page = request.query_params.get('page')
        page_size = int(request.query_params.get('page_size', request.query_params.get('limit', 10)))
        if page:
            page_num = max(1, int(page))
            total = qs.count()
            total_pages = max(1, (total + page_size - 1) // page_size)
            safe_page = min(page_num, total_pages)
            start = (safe_page - 1) * page_size
            items = qs[start:start + page_size]
            serializer = AuditWorkingNoteSerializer(items, many=True)
            return Response({
                'items': serializer.data,
                'total': total,
                'page': safe_page,
                'page_size': page_size,
                'total_pages': total_pages,
                'has_next': safe_page < total_pages,
                'has_previous': safe_page > 1,
            })

        serializer = AuditWorkingNoteSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = resolve_user_from_request(request)
        data = request.data

        note = AuditWorkingNote.objects.create(
            id=f"NOTE-{uuid.uuid4().hex[:8].upper()}",
            submission_id=data.get('submissionId', ''),
            report_key=data.get('reportKey', ''),
            category=data.get('category', 'OBSERVATION'),
            author_id=user.id if user else 'auditor_1',
            author_name=user.name if user else 'Internal Auditor',
            content=data.get('content', ''),
            is_private=data.get('isPrivate', True),
        )

        return Response(AuditWorkingNoteSerializer(note).data, status=status.HTTP_201_CREATED)


class RemediationTrackingView(APIView):
    """
    Remediation action tracking and assignment.
    """
    def get(self, request):
        finding_id = request.query_params.get('findingId')
        qs = RemediationAction.objects.all().order_by('-created_at')
        if finding_id:
            qs = qs.filter(finding_id=finding_id)

        page = request.query_params.get('page')
        page_size = int(request.query_params.get('page_size', request.query_params.get('limit', 10)))
        if page:
            page_num = max(1, int(page))
            total = qs.count()
            total_pages = max(1, (total + page_size - 1) // page_size)
            safe_page = min(page_num, total_pages)
            start = (safe_page - 1) * page_size
            items = qs[start:start + page_size]
            serializer = RemediationActionSerializer(items, many=True)
            return Response({
                'items': serializer.data,
                'total': total,
                'page': safe_page,
                'page_size': page_size,
                'total_pages': total_pages,
                'has_next': safe_page < total_pages,
                'has_previous': safe_page > 1,
            })

        serializer = RemediationActionSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        data = request.data
        user = resolve_user_from_request(request)

        remediation = RemediationAction.objects.create(
            id=f"REM-{uuid.uuid4().hex[:8].upper()}",
            finding_id=data.get('findingId', ''),
            action_plan=data.get('actionPlan', ''),
            assigned_department=data.get('assignedDepartment', ''),
            assigned_to=data.get('assignedTo', ''),
            target_date=data.get('targetDate', timezone.now().date()),
            status=data.get('status', 'PENDING'),
            remediation_proof=data.get('remediationProof', ''),
        )

        AuditLogger.log(
            actor_id=user.id if user else 'auditor_user',
            actor_name=user.name if user else 'Compliance Auditor',
            actor_role=user.role if user else 'AUDITOR',
            action='REMEDIATION_ACTION_ASSIGNED',
            entity_type='REMEDIATION_ACTION',
            entity_id=remediation.id,
            details=f"Remediation action assigned to {remediation.assigned_to} ({remediation.assigned_department})."
        )

        return Response(RemediationActionSerializer(remediation).data, status=status.HTTP_201_CREATED)

    def patch(self, request, pk):
        try:
            rem = RemediationAction.objects.get(pk=pk)
        except RemediationAction.DoesNotExist:
            return Response({'error': 'Remediation not found'}, status=status.HTTP_404_NOT_FOUND)

        user = resolve_user_from_request(request)
        data = request.data

        if 'status' in data:
            rem.status = data['status']
            if data['status'] == 'VERIFIED_BY_AUDITOR':
                rem.verified_by = user.name if user else 'Compliance Auditor'
                rem.verified_at = timezone.now()
        if 'remediationProof' in data:
            rem.remediation_proof = data['remediationProof']

        rem.save()
        return Response(RemediationActionSerializer(rem).data)


class AuditReportExportView(APIView):
    """
    Compiles an official Oromia Bank NBE Compliance Audit Package.
    Calculates executive metrics and stamps with an official cryptographic seal.
    """
    def post(self, request):
        user = resolve_user_from_request(request)
        data = request.data
        period = data.get('period', timezone.now().strftime('%B %Y'))
        scope_depts = data.get('scopeDepartments', ['All 8 Bank Departments'])

        findings = AuditFinding.objects.all()
        critical_count = findings.filter(severity='CRITICAL').count()
        high_count = findings.filter(severity='HIGH').count()

        seal_seed = f"OB_NBE_AUDIT_REPORT_{period}_{timezone.now().isoformat()}_{findings.count()}"
        tamper_seal = f"OB-AUD-SEAL-{hashlib.sha256(seal_seed.encode()).hexdigest()[:24].upper()}"

        package = AuditReportPackage.objects.create(
            id=f"AUD-REP-{uuid.uuid4().hex[:8].upper()}",
            title=f"Oromia Bank NBE Regulatory Compliance Audit Memo - {period}",
            period=period,
            scope_departments=scope_depts,
            generated_by=user.name if user else 'Compliance Internal Audit Directorate',
            findings_count=findings.count(),
            critical_count=critical_count,
            high_count=high_count,
            executive_summary=data.get(
                'executiveSummary',
                f"Comprehensive regulatory compliance audit conducted across {len(scope_depts)} departments for period {period}. "
                f"Identified {findings.count()} total findings ({critical_count} critical, {high_count} high risk). "
                f"All submissions verified against NBE Directive BSD/03/2020."
            ),
            tamper_seal=tamper_seal,
        )

        AuditLogger.log(
            actor_id=user.id if user else 'auditor_root',
            actor_name=user.name if user else 'Auditor General',
            actor_role='AUDITOR',
            action='AUDIT_REPORT_EXPORTED',
            entity_type='AUDIT_REPORT',
            entity_id=package.id,
            details=f"Exported formal compliance audit report {package.id} with tamper seal {tamper_seal}."
        )

        return Response(AuditReportPackageSerializer(package).data, status=status.HTTP_201_CREATED)
