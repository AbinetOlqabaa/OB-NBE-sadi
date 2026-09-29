from rest_framework import serializers
from .models import SpecialAccessGrant

class SpecialAccessGrantSerializer(serializers.ModelSerializer):
    reportKey = serializers.CharField(source='report_key', required=False, allow_blank=True)
    grantedBy = serializers.CharField(source='granted_by', required=False, allow_blank=True)
    grantedAt = serializers.DateTimeField(source='granted_at', read_only=True)
    expiresAt = serializers.DateTimeField(source='expires_at', required=False, allow_null=True)
    revokedAt = serializers.DateTimeField(source='revoked_at', read_only=True)
    revokedBy = serializers.CharField(source='revoked_by', read_only=True)
    isActive = serializers.SerializerMethodField()

    class Meta:
        model = SpecialAccessGrant
        fields = [
            'id',
            'reportKey',
            'department',
            'departments',
            'reason',
            'grantedBy',
            'grantedAt',
            'expiresAt',
            'revoked',
            'revokedAt',
            'revokedBy',
            'isActive',
        ]

    def get_isActive(self, obj):
        return obj.is_active()
