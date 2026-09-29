from rest_framework import serializers
from .models import Department

class DepartmentSerializer(serializers.ModelSerializer):
    reportKeys = serializers.SerializerMethodField()
    shortCode = serializers.CharField(source='short_code')
    primaryResponsibilities = serializers.JSONField(source='primary_responsibilities')

    class Meta:
        model = Department
        fields = [
            'id',
            'name',
            'shortCode',
            'division',
            'description',
            'primaryResponsibilities',
            'reportKeys',
        ]

    def get_reportKeys(self, obj):
        # Check reverse relation from reports app if loaded
        if hasattr(obj, 'reports'):
            return list(obj.reports.values_list('return_key', flat=True))
        return []
