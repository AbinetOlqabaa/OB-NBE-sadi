from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from .models import SpecialAccessGrant
from .serializers import SpecialAccessGrantSerializer
from apps.accounts.models import UserAccount
from apps.audit.audit_logger import AuditLogger

class GrantSpecialAccessView(APIView):
    """
    POST: Administrative assignment of Special Access Grant to a Maker or Checker.
    """
    def post(self, request, user_id):
        try:
            target_user = UserAccount.objects.get(pk=user_id)
        except UserAccount.DoesNotExist:
            return Response({'success': False, 'message': f'User {user_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        report_key = data.get('reportKey', '')
        department = data.get('department', '')
        departments = data.get('departments', [])
        reason = data.get('reason', '')
        expires_at = data.get('expiresAt')
        admin_name = data.get('adminName', 'System Administrator')

        if not reason:
            return Response({'success': False, 'message': 'Formal compliance justification reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        grant = SpecialAccessGrant.objects.create(
            user=target_user,
            report_key=report_key,
            department=department,
            departments=departments if isinstance(departments, list) else [],
            reason=reason,
            granted_by=admin_name,
            expires_at=expires_at
        )

        AuditLogger.log(
            actor_id='usr_admin',
            actor_name=admin_name,
            actor_role='ADMIN',
            action='SPECIAL_ACCESS_GRANTED',
            entity_type='USER_PERMISSION',
            entity_id=target_user.id,
            details=f"Special Access Grant {grant.id} created for {target_user.name} ({target_user.role}). Reason: {reason}"
        )

        from apps.accounts.serializers import UserAccountSerializer
        return Response({
            'success': True,
            'grant': SpecialAccessGrantSerializer(grant).data,
            'user': UserAccountSerializer(target_user).data
        }, status=status.HTTP_201_CREATED)

class RevokeSpecialAccessView(APIView):
    """
    DELETE: Administrative revocation of a Special Access Grant.
    """
    def delete(self, request, user_id, grant_id):
        admin_name = request.query_params.get('adminName', 'System Administrator')
        try:
            grant = SpecialAccessGrant.objects.get(id=grant_id, user_id=user_id)
        except SpecialAccessGrant.DoesNotExist:
            return Response({'success': False, 'message': 'Grant not found.'}, status=status.HTTP_404_NOT_FOUND)

        grant.revoked = True
        grant.revoked_at = timezone.now()
        grant.revoked_by = admin_name
        grant.save()

        AuditLogger.log(
            actor_id='usr_admin',
            actor_name=admin_name,
            actor_role='ADMIN',
            action='SPECIAL_ACCESS_REVOKED',
            entity_type='USER_PERMISSION',
            entity_id=user_id,
            details=f"Special Access Grant {grant_id} revoked by {admin_name}."
        )

        from apps.accounts.serializers import UserAccountSerializer
        target_user = grant.user
        return Response({
            'success': True,
            'message': 'Special access revoked.',
            'user': UserAccountSerializer(target_user).data
        })
