from rest_framework import serializers
from .models import UserAccount, BiometricCredential
from apps.permissions.serializers import SpecialAccessGrantSerializer

class BiometricCredentialSerializer(serializers.ModelSerializer):
    credentialId = serializers.CharField(source='credential_id')
    deviceLabel = serializers.CharField(source='device_label', required=False, allow_blank=True)
    faceHash = serializers.CharField(source='face_hash', required=False, allow_blank=True)
    publicKey = serializers.CharField(source='public_key', required=False, allow_blank=True)
    enrolledAt = serializers.DateTimeField(source='enrolled_at', read_only=True)

    class Meta:
        model = BiometricCredential
        fields = ['type', 'credentialId', 'deviceLabel', 'faceHash', 'publicKey', 'enrolledAt']

class UserAccountSerializer(serializers.ModelSerializer):
    institutionCode = serializers.CharField(source='institution_code')
    employeeId = serializers.CharField(source='employee_id')
    phoneNumber = serializers.CharField(source='phone_number', required=False, allow_blank=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    approvedAt = serializers.DateTimeField(source='approved_at', read_only=True, required=False, allow_null=True)
    approvedBy = serializers.CharField(source='approved_by', read_only=True, required=False, allow_blank=True)
    lastLoginAt = serializers.DateTimeField(source='last_login_at', read_only=True, required=False, allow_null=True)
    specialAccessGrants = SpecialAccessGrantSerializer(source='special_access_grants', many=True, read_only=True)
    biometricCredentials = BiometricCredentialSerializer(source='biometric_credentials', many=True, read_only=True)

    class Meta:
        model = UserAccount
        fields = [
            'id',
            'name',
            'email',
            'role',
            'status',
            'institutionCode',
            'department',
            'employeeId',
            'phoneNumber',
            'createdAt',
            'approvedAt',
            'approvedBy',
            'lastLoginAt',
            'specialAccessGrants',
            'biometricCredentials',
        ]
