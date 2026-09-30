from rest_framework import serializers
from .models import Department, DepartmentReportAssignment

class DepartmentReportAssignmentSerializer(serializers.ModelSerializer):
    departmentId = serializers.CharField(source='department.id', read_only=True)
    reportKey = serializers.CharField(source='report_key')
    isActive = serializers.BooleanField(source='is_active')
    effectiveFrom = serializers.DateTimeField(source='effective_from')
    effectiveTo = serializers.DateTimeField(source='effective_to', allow_null=True)
    assignedBy = serializers.CharField(source='assigned_by', allow_blank=True)

    class Meta:
        model = DepartmentReportAssignment
        fields = [
            'id',
            'departmentId',
            'reportKey',
            'role',
            'isActive',
            'effectiveFrom',
            'effectiveTo',
            'notes',
            'assignedBy',
        ]

class DepartmentSerializer(serializers.ModelSerializer):
    reportKeys = serializers.SerializerMethodField()
    shortCode = serializers.CharField(source='short_code')
    primaryResponsibilities = serializers.JSONField(source='primary_responsibilities')
    parentId = serializers.CharField(source='parent.id', allow_null=True, required=False)
    hierarchyLevel = serializers.IntegerField(source='hierarchy_level', required=False)
    effectiveFrom = serializers.DateTimeField(source='effective_from', required=False)
    effectiveTo = serializers.DateTimeField(source='effective_to', allow_null=True, required=False)
    reportAssignments = DepartmentReportAssignmentSerializer(source='report_assignments', many=True, read_only=True)

    class Meta:
        model = Department
        fields = [
            'id',
            'name',
            'shortCode',
            'division',
            'description',
            'parentId',
            'hierarchyLevel',
            'path',
            'status',
            'primaryResponsibilities',
            'effectiveFrom',
            'effectiveTo',
            'reportKeys',
            'reportAssignments',
        ]

    def get_reportKeys(self, obj):
        return obj.report_keys
