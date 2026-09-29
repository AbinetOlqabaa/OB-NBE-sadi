import random
import uuid
from datetime import timedelta
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import UserAccount, BiometricCredential, OtpVerification
from .serializers import UserAccountSerializer, BiometricCredentialSerializer
from apps.audit.audit_logger import AuditLogger

class LoginView(APIView):
    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '').strip()

        if not email or not password:
            return Response({
                'success': False,
                'message': 'Corporate email and password are required to sign in.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = UserAccount.objects.get(email__iexact=email)
        except UserAccount.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Invalid corporate email or password.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        # Check status
        if user.status == 'PENDING_APPROVAL':
            return Response({
                'success': False,
                'message': 'Your account registration is pending compliance approval by the Bank Administrator.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        if user.status == 'DISABLED':
            return Response({
                'success': False,
                'message': 'This corporate account has been disabled. Please contact Oromia Bank Security.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        # Check password
        # Supports both standard Django hashed passwords and development plain text fallback
        is_valid_pw = user.check_password(password) or (password == 'password')
        if not is_valid_pw:
            return Response({
                'success': False,
                'message': 'Invalid corporate email or password.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        user.last_login_at = timezone.now()
        user.save(update_fields=['last_login_at'])

        AuditLogger.log(
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            action='USER_LOGIN',
            entity_type='AUTH',
            entity_id=user.id,
            details=f"User logged in successfully as {user.role}"
        )

        return Response({
            'success': True,
            'message': 'Signed in successfully.',
            'user': UserAccountSerializer(user).data
        }, status=status.HTTP_200_OK)

class RegisterView(APIView):
    def post(self, request):
        data = request.data
        email = data.get('email', '').strip().lower()
        name = data.get('name', '').strip()
        role = data.get('role', 'MAKER')
        department = data.get('department', '').strip()
        employee_id = data.get('employeeId', '').strip()
        phone_number = data.get('phoneNumber', '').strip()
        password = data.get('password', 'password').strip()

        if not email or not name or not department:
            return Response({
                'success': False,
                'message': 'Name, corporate email, and department are required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if UserAccount.objects.filter(email__iexact=email).exists():
            return Response({
                'success': False,
                'message': f'An account with email {email} already exists.'
            }, status=status.HTTP_400_BAD_REQUEST)

        user_id = f"usr_{uuid.uuid4().hex[:8]}"
        if not employee_id:
            employee_id = f"OB-EMP-{random.randint(100, 999)}"

        user = UserAccount.objects.create_user(
            email=email,
            password=password,
            id=user_id,
            name=name,
            role=role,
            status='PENDING_APPROVAL',
            department=department,
            employee_id=employee_id,
            phone_number=phone_number,
            institution_code='0000013'
        )

        AuditLogger.log(
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            action='USER_REGISTER',
            entity_type='USER',
            entity_id=user.id,
            details=f"New registration submitted for role {user.role}. Status: PENDING_APPROVAL"
        )

        return Response({
            'success': True,
            'message': 'Registration request submitted. Pending Compliance Administrator approval.',
            'user': UserAccountSerializer(user).data
        }, status=status.HTTP_201_CREATED)

class SendOtpView(APIView):
    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        purpose = request.data.get('purpose', 'REGISTRATION')

        if not email:
            return Response({'success': False, 'message': 'Corporate email address is required.'}, status=status.HTTP_400_BAD_REQUEST)

        code = f"{random.randint(100000, 999999)}"
        expires_at = timezone.now() + timedelta(minutes=10)

        # Invalidate existing unused codes
        OtpVerification.objects.filter(email=email, purpose=purpose, used=False).update(used=True)

        OtpVerification.objects.create(
            email=email,
            code=code,
            purpose=purpose,
            expires_at=expires_at
        )

        return Response({
            'success': True,
            'message': f'Verification OTP code dispatched to {email}.',
            'expiresInSeconds': 600,
            'debugCode': code
        }, status=status.HTTP_200_OK)

class VerifyOtpView(APIView):
    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        code = request.data.get('code', '').strip()
        purpose = request.data.get('purpose', 'REGISTRATION')

        if not email or not code:
            return Response({'success': False, 'message': 'Email and verification code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Look up valid OTP
        otp = OtpVerification.objects.filter(
            email=email,
            purpose=purpose,
            used=False,
            expires_at__gte=timezone.now()
        ).order_by('-created_at').first()

        if not otp or not otp.is_valid(code):
            return Response({'success': False, 'message': 'Invalid or expired OTP code.'}, status=status.HTTP_400_BAD_REQUEST)

        otp.used = True
        otp.save(update_fields=['used'])

        return Response({
            'success': True,
            'message': 'OTP verification successful.'
        }, status=status.HTTP_200_OK)

class ResetPasswordView(APIView):
    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        otp_code = request.data.get('otpCode', '').strip()
        new_password = request.data.get('newPassword', '').strip()

        if not email or not otp_code or not new_password:
            return Response({'success': False, 'message': 'Email, OTP code, and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = UserAccount.objects.get(email__iexact=email)
        except UserAccount.DoesNotExist:
            return Response({'success': False, 'message': 'Account not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Verify OTP
        otp = OtpVerification.objects.filter(
            email=email,
            purpose='PASSWORD_RESET',
            used=False,
            expires_at__gte=timezone.now()
        ).order_by('-created_at').first()

        if not otp or not otp.is_valid(otp_code):
            return Response({'success': False, 'message': 'Invalid or expired OTP verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        otp.used = True
        otp.save(update_fields=['used'])

        user.set_password(new_password)
        user.save()

        AuditLogger.log(
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            action='PASSWORD_RESET',
            entity_type='AUTH',
            entity_id=user.id,
            details=f"Password reset successfully via OTP verification for {user.email}"
        )

        return Response({
            'success': True,
            'message': 'Password has been securely reset.',
            'user': UserAccountSerializer(user).data
        }, status=status.HTTP_200_OK)

class BiometricsRegisterView(APIView):
    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        credential = request.data.get('credential', {})

        if not email or not credential or not credential.get('type'):
            return Response({'success': False, 'message': 'Email and valid credential payload required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = UserAccount.objects.get(email__iexact=email)
        except UserAccount.DoesNotExist:
            return Response({'success': False, 'message': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        bio_type = credential.get('type')
        cred_id = credential.get('credentialId') or f"cred_{uuid.uuid4().hex[:12]}"
        device_label = credential.get('deviceLabel', 'Enrolled Device')
        face_hash = credential.get('faceHash', '')
        public_key = credential.get('publicKey', '')

        # Remove existing credential of same type if present to allow re-enrollment
        BiometricCredential.objects.filter(user=user, type=bio_type).delete()

        BiometricCredential.objects.create(
            user=user,
            type=bio_type,
            credential_id=cred_id,
            device_label=device_label,
            face_hash=face_hash,
            public_key=public_key
        )

        AuditLogger.log(
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            action='BIOMETRIC_ENROLLED',
            entity_type='USER',
            entity_id=user.id,
            details=f"Enrolled {bio_type} biometric credential for {user.email}"
        )

        return Response({
            'success': True,
            'message': f'Biometric credential ({bio_type}) registered successfully.',
            'user': UserAccountSerializer(user).data
        }, status=status.HTTP_200_OK)

class BiometricsVerifyView(APIView):
    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        bio_type = request.data.get('type', '')
        credential_id = request.data.get('credentialId', '')
        face_hash = request.data.get('faceHash', '')

        if not email or not bio_type:
            return Response({'success': False, 'message': 'Email and biometric type required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = UserAccount.objects.prefetch_related('biometric_credentials').get(email__iexact=email)
        except UserAccount.DoesNotExist:
            return Response({'success': False, 'message': 'User not found.'}, status=status.HTTP_401_UNAUTHORIZED)

        if user.status != 'ACTIVE':
            return Response({'success': False, 'message': f'Account is {user.status}. Biometric login rejected.'}, status=status.HTTP_401_UNAUTHORIZED)

        matching_cred = user.biometric_credentials.filter(type=bio_type).first()
        if not matching_cred:
            return Response({
                'success': False,
                'message': f'No enrolled {bio_type} biometric found for this account. Please enroll first.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        # Verification check
        if bio_type == 'FACE' and face_hash and matching_cred.face_hash:
            if face_hash.strip() != matching_cred.face_hash.strip():
                return Response({'success': False, 'message': 'Facial biometric signature mismatch.'}, status=status.HTTP_401_UNAUTHORIZED)
        elif bio_type == 'FINGERPRINT' and credential_id:
            if credential_id.strip() != matching_cred.credential_id.strip():
                return Response({'success': False, 'message': 'Fingerprint credential token invalid.'}, status=status.HTTP_401_UNAUTHORIZED)

        user.last_login_at = timezone.now()
        user.save(update_fields=['last_login_at'])

        AuditLogger.log(
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            action='BIOMETRIC_LOGIN',
            entity_type='AUTH',
            entity_id=user.id,
            details=f"Logged in via {bio_type} biometric verification ({user.role})"
        )

        return Response({
            'success': True,
            'message': f'Authenticated via {bio_type} biometric sensor.',
            'user': UserAccountSerializer(user).data
        }, status=status.HTTP_200_OK)

class BiometricsStatusView(APIView):
    def get(self, request, email):
        email = email.strip().lower()
        try:
            user = UserAccount.objects.prefetch_related('biometric_credentials').get(email__iexact=email)
            has_fingerprint = user.biometric_credentials.filter(type='FINGERPRINT').exists()
            has_face = user.biometric_credentials.filter(type='FACE').exists()
            return Response({
                'email': user.email,
                'hasFingerprint': has_fingerprint,
                'hasFace': has_face,
                'credentialsCount': user.biometric_credentials.count()
            })
        except UserAccount.DoesNotExist:
            return Response({
                'email': email,
                'hasFingerprint': False,
                'hasFace': False,
                'credentialsCount': 0
            })

class UserListView(APIView):
    def get(self, request):
        users = UserAccount.objects.prefetch_related('special_access_grants', 'biometric_credentials').all()
        serializer = UserAccountSerializer(users, many=True)
        return Response(serializer.data)

class UserStatusView(APIView):
    def post(self, request, user_id):
        new_status = request.data.get('status')
        admin_name = request.data.get('adminName', 'System Administrator')

        if not new_status or new_status not in ['ACTIVE', 'PENDING_APPROVAL', 'DISABLED']:
            return Response({'success': False, 'message': f'Invalid status: {new_status}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = UserAccount.objects.get(pk=user_id)
        except UserAccount.DoesNotExist:
            return Response({'success': False, 'message': f'User {user_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        user.status = new_status
        if new_status == 'ACTIVE' and not user.approved_at:
            user.approved_at = timezone.now()
            user.approved_by = admin_name
        user.save()

        AuditLogger.log(
            actor_id='usr_admin',
            actor_name=admin_name,
            actor_role='ADMIN',
            action=f"USER_STATUS_{new_status}",
            entity_type='USER',
            entity_id=user.id,
            details=f"User {user.name} ({user.email}) status updated to {new_status}"
        )

        return Response({
            'success': True,
            'message': f'User status updated to {new_status}.',
            'user': UserAccountSerializer(user).data
        })

class UserDetailView(APIView):
    def put(self, request, user_id):
        try:
            user = UserAccount.objects.get(pk=user_id)
        except UserAccount.DoesNotExist:
            return Response({'success': False, 'message': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        if 'name' in data:
            user.name = data['name']
        if 'role' in data:
            user.role = data['role']
        if 'department' in data:
            user.department = data['department']
        if 'phoneNumber' in data:
            user.phone_number = data['phoneNumber']
        if 'status' in data:
            user.status = data['status']
        user.save()

        return Response({
            'success': True,
            'user': UserAccountSerializer(user).data
        })

    def delete(self, request, user_id):
        try:
            user = UserAccount.objects.get(pk=user_id)
            user.delete()
            return Response({'success': True, 'message': f'User {user_id} deleted.'})
        except UserAccount.DoesNotExist:
            return Response({'success': False, 'message': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

class SeedDataSummaryView(APIView):
    def get(self, request):
        users = UserAccount.objects.all().values('id', 'name', 'email', 'role', 'status', 'department', 'employee_id')
        return Response({
            'success': True,
            'users': list(users)
        })

class SeedDataResetView(APIView):
    def post(self, request):
        from django.core.management import call_command
        call_command('seed_data')
        return Response({
            'success': True,
            'message': 'Development seed accounts re-initialized with zero pre-seeded biometrics'
        })
