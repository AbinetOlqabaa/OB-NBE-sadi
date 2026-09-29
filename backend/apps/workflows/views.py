import uuid
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
from .models import Submission
from .serializers import SubmissionSerializer
from .workflow_engine import WorkflowEngine
from apps.reports.models import RegulatoryReport
from apps.accounts.models import UserAccount
from apps.permissions.authorization import AuthorizationEngine
from apps.audit.audit_logger import AuditLogger
from apps.notifications.notifier import NotificationService
from apps.nbe_gateway.gateway_service import NbeGatewayService

def resolve_user_from_request(request):
    """
    Resolves authoritative UserAccount from session, bearer token, or request payload user object/email.
    """
    user_data = request.data.get('user') if isinstance(request.data, dict) else None
    email = None
    if isinstance(user_data, dict):
        email = user_data.get('email')
    elif request.user and request.user.is_authenticated:
        return request.user

    if not email:
        email = request.headers.get('X-User-Email')

    if email:
        try:
            return UserAccount.objects.prefetch_related('special_access_grants').get(email__iexact=email)
        except UserAccount.DoesNotExist:
            pass

    # Default to first active maker for dev fallback if no user specified
    return UserAccount.objects.filter(role='MAKER', status='ACTIVE').first()

class SubmissionListView(APIView):
    def get(self, request):
        qs = Submission.objects.all()
        status_filter = request.query_params.get('status')
        report_key = request.query_params.get('reportKey')
        maker_id = request.query_params.get('makerId')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if report_key:
            qs = qs.filter(report_key=report_key)
        if maker_id:
            qs = qs.filter(maker_id=maker_id)

        serializer = SubmissionSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        data = request.data
        report_key = data.get('reportKey')
        if not report_key:
            return Response({'error': 'Missing reportKey'}, status=status.HTTP_400_BAD_REQUEST)

        user = resolve_user_from_request(request)
        if not user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        # Enforce Maker authority for report
        authorized, reason = AuthorizationEngine.evaluate_access(user, report_key, 'CREATE_DRAFT')
        if not authorized:
            return Response({'error': reason}, status=status.HTTP_403_FORBIDDEN)

        try:
            report = RegulatoryReport.objects.get(return_key=report_key)
        except RegulatoryReport.DoesNotExist:
            return Response({'error': f'Template {report_key} not found'}, status=status.HTTP_404_NOT_FOUND)

        sub_id = f"sub_{report_key.lower()}_{uuid.uuid4().hex[:8]}"
        initial_values = {}
        for item in report.return_items_list:
            if isinstance(item, dict) and 'Code' in item:
                initial_values[item['Code']] = item.get('Value', '')

        submission = Submission.objects.create(
            id=sub_id,
            report_key=report_key,
            period_year=report.fin_year or 2026,
            period_quarter=1 if report.frequency == 'QUARTERLY' else None,
            period_month=7 if report.frequency == 'MONTHLY' else None,
            status='DRAFT',
            version=1,
            maker_id=user.id,
            maker_name=user.name,
            maker_dept=user.department,
            values=initial_values,
            dynamic_rows={},
            validation_summary={'isValid': True, 'errorCount': 0, 'warningCount': 0, 'errors': []},
            comments=[],
            snapshots=[]
        )

        AuditLogger.log(
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            action='CREATE_DRAFT',
            entity_type='REPORT_SUBMISSION',
            entity_id=submission.id,
            details=f"Created new draft for return {report_key} (v1)"
        )

        return Response(SubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)

class SubmissionDetailView(APIView):
    def get(self, request, pk):
        try:
            sub = Submission.objects.get(pk=pk)
            return Response(SubmissionSerializer(sub).data)
        except Submission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

    def put(self, request, pk):
        try:
            sub = Submission.objects.get(pk=pk)
        except Submission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

        user = resolve_user_from_request(request)
        if not user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        # Enforce edit authority
        if sub.status not in ('DRAFT', 'CORRECTION_REQUIRED'):
            return Response({'error': f"Cannot edit submission in status '{sub.status}'."}, status=status.HTTP_400_BAD_REQUEST)

        authorized, reason = AuthorizationEngine.evaluate_access(user, sub.report_key, 'EDIT_DRAFT', sub)
        if not authorized:
            return Response({'error': reason}, status=status.HTTP_403_FORBIDDEN)

        values = request.data.get('values')
        dynamic_rows = request.data.get('dynamicRows')

        if values is not None:
            sub.values = values
        if dynamic_rows is not None:
            sub.dynamic_rows = dynamic_rows

        sub.updated_at = timezone.now()
        sub.save()

        return Response(SubmissionSerializer(sub).data)

class SubmissionValidateView(APIView):
    def post(self, request, pk):
        try:
            sub = Submission.objects.get(pk=pk)
        except Submission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

        # Basic validation summary
        summary = {
            'isValid': True,
            'errorCount': 0,
            'warningCount': 0,
            'errors': [],
            'warnings': []
        }
        sub.validation_summary = summary
        sub.save(update_fields=['validation_summary'])
        return Response(summary)

class SubmissionSubmitView(APIView):
    def post(self, request, pk):
        try:
            sub = Submission.objects.get(pk=pk)
        except Submission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

        user = resolve_user_from_request(request)
        if not user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        comment_text = request.data.get('comment', 'Submitted for Checker review.')

        # Enforce transition rules
        can_trans, err_msg = WorkflowEngine.can_transition(sub.status, 'PENDING_CHECKER', user, sub)
        if not can_trans:
            return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

        sub.status = 'PENDING_CHECKER'
        sub.submitted_at = timezone.now()
        sub.updated_at = timezone.now()

        comments = list(sub.comments or [])
        comments.append({
            'id': f"cmt_{uuid.uuid4().hex[:8]}",
            'authorId': user.id,
            'authorName': user.name,
            'authorRole': user.role,
            'createdAt': timezone.now().isoformat(),
            'text': comment_text,
            'action': 'SUBMIT'
        })
        sub.comments = comments
        sub.save()

        AuditLogger.log(
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            action='MAKER_SUBMIT',
            entity_type='REPORT_SUBMISSION',
            entity_id=sub.id,
            details=f"Maker {user.name} submitted return {sub.report_key} (v{sub.version}) for Checker review."
        )

        # Notify Checkers
        NotificationService.notify_department_checkers(
            department=sub.maker_dept,
            report_key=sub.report_key,
            submission_id=sub.id,
            maker_name=user.name
        )

        return Response(SubmissionSerializer(sub).data)

class SubmissionReviewView(APIView):
    def post(self, request, pk):
        try:
            sub = Submission.objects.get(pk=pk)
        except Submission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

        user = resolve_user_from_request(request)
        if not user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        action = request.data.get('action')
        comment_text = request.data.get('comment', '')

        action_map = {
            'APPROVE': 'APPROVED',
            'REJECT': 'REJECTED',
            'REQUEST_CORRECTION': 'CORRECTION_REQUIRED',
        }
        target_status = action_map.get(action)
        if not target_status:
            return Response({'error': f"Invalid review action '{action}'"}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce transition rules & 4-eyes segregation
        can_trans, err_msg = WorkflowEngine.can_transition(sub.status, target_status, user, sub)
        if not can_trans:
            return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

        sub.status = target_status
        sub.checker_id = user.id
        sub.checker_name = user.name
        sub.reviewed_at = timezone.now()
        sub.updated_at = timezone.now()

        comments = list(sub.comments or [])
        comments.append({
            'id': f"cmt_{uuid.uuid4().hex[:8]}",
            'authorId': user.id,
            'authorName': user.name,
            'authorRole': user.role,
            'createdAt': timezone.now().isoformat(),
            'text': comment_text or f"Checker decision: {action}",
            'action': action
        })
        sub.comments = comments
        sub.save()

        AuditLogger.log(
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            action=f"CHECKER_{action}",
            entity_type='REPORT_SUBMISSION',
            entity_id=sub.id,
            details=f"Checker {user.name} reviewed return {sub.report_key} -> {target_status}. Comment: {comment_text}"
        )

        NotificationService.notify_user(
            user_id=sub.maker_id,
            title=f"Return {sub.report_key} {action}",
            message=f"Checker {user.name} reviewed your submission: {action}. Comment: {comment_text}",
            level='SUCCESS' if action == 'APPROVE' else 'WARNING'
        )

        return Response(SubmissionSerializer(sub).data)

class SubmissionDeliverView(APIView):
    def post(self, request, pk):
        try:
            sub = Submission.objects.get(pk=pk)
        except Submission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

        user = resolve_user_from_request(request)
        if not user:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        # Enforce Maker authority for final NBE delivery
        can_trans, err_msg = WorkflowEngine.can_transition(sub.status, 'SENDING', user, sub)
        if not can_trans:
            return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

        sub.status = 'SENDING'
        sub.save(update_fields=['status'])

        # Execute delivery through NBE Gateway
        result = NbeGatewayService.transmit_submission(sub, user)

        if result.get('success'):
            sub.status = 'SENT'
            sub.delivered_at = timezone.now()
            sub.nbe_submission_id = result.get('submissionId', '')
            sub.nbe_correlation_id = result.get('correlationId', '')
            sub.nbe_response = result
            sub.updated_at = timezone.now()
            sub.save()

            AuditLogger.log(
                actor_id=user.id,
                actor_name=user.name,
                actor_role=user.role,
                action='NBE_DELIVERY_CONFIRMED',
                entity_type='REPORT_SUBMISSION',
                entity_id=sub.id,
                correlation_id=sub.nbe_correlation_id,
                details=f"Delivered return {sub.report_key} to NBE Gateway. Receipt: {sub.nbe_submission_id}"
            )
            return Response(result, status=status.HTTP_200_OK)
        else:
            sub.status = 'FAILED'
            sub.nbe_response = result
            sub.updated_at = timezone.now()
            sub.save()

            AuditLogger.log(
                actor_id=user.id,
                actor_name=user.name,
                actor_role=user.role,
                action='NBE_DELIVERY_FAILED',
                entity_type='REPORT_SUBMISSION',
                entity_id=sub.id,
                details=f"Failed delivery to NBE Gateway for {sub.report_key}: {result.get('error')}"
            )
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

class SubmissionBatchSyncView(APIView):
    def post(self, request):
        submissions = request.data.get('submissions', [])
        if not isinstance(submissions, list):
            return Response({'error': 'Expected submissions array'}, status=status.HTTP_400_BAD_REQUEST)

        synced_count = 0
        for incoming in submissions:
            if not isinstance(incoming, dict) or not incoming.get('id'):
                continue
            sub_id = incoming.get('id')
            existing = Submission.objects.filter(id=sub_id).first()
            if not existing:
                Submission.objects.create(
                    id=sub_id,
                    report_key=incoming.get('reportKey', ''),
                    period_year=incoming.get('periodYear', 2026),
                    period_quarter=incoming.get('periodQuarter'),
                    period_month=incoming.get('periodMonth'),
                    status=incoming.get('status', 'DRAFT'),
                    version=incoming.get('version', 1),
                    maker_id=incoming.get('makerId', 'mkr_site'),
                    maker_name=incoming.get('makerName', 'Field Examiner'),
                    maker_dept=incoming.get('makerDept', 'Credit Operations & Portfolio Management'),
                    values=incoming.get('values', {}),
                    dynamic_rows=incoming.get('dynamicRows', {}),
                    validation_summary=incoming.get('validationSummary', {})
                )
                synced_count += 1
            else:
                existing.values = incoming.get('values', existing.values)
                existing.dynamic_rows = incoming.get('dynamicRows', existing.dynamic_rows)
                existing.updated_at = timezone.now()
                existing.save()
                synced_count += 1

        all_subs = Submission.objects.all()
        return Response({
            'success': True,
            'syncedCount': synced_count,
            'submissions': SubmissionSerializer(all_subs, many=True).data
        })

class SubmissionExportXlsxView(APIView):
    def get(self, request, pk):
        try:
            sub = Submission.objects.get(pk=pk)
            report = RegulatoryReport.objects.get(return_key=sub.report_key)
        except (Submission.DoesNotExist, RegulatoryReport.DoesNotExist):
            return Response({'error': 'Submission or template not found'}, status=status.HTTP_404_NOT_FOUND)

        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = sub.report_key[:30]

        ws.append(["Code", "Description", "Value"])
        for item in report.return_items_list:
            code = item.get('Code', '')
            desc = item.get('_description', '')
            val = sub.values.get(code, '')
            ws.append([code, desc, val])

        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{sub.report_key}_{sub.period_year}_v{sub.version}.xlsx"'
        wb.save(response)
        return response
