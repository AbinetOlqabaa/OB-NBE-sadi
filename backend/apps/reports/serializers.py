from rest_framework import serializers
from .models import RegulatoryReport

class RegulatoryReportListSerializer(serializers.ModelSerializer):
    ReturnKey = serializers.CharField(source='return_key')
    Code = serializers.CharField(source='code')
    Title = serializers.CharField(source='title')
    Category = serializers.CharField(source='category')
    Frequency = serializers.CharField(source='frequency')
    InstCode = serializers.CharField(source='inst_code')
    FinYear = serializers.IntegerField(source='fin_year')
    StartDate = serializers.CharField(source='start_date')
    EndDate = serializers.CharField(source='end_date')
    Description = serializers.CharField(source='description')
    department = serializers.SerializerMethodField()
    itemCount = serializers.SerializerMethodField()
    dynamicAreaCount = serializers.SerializerMethodField()
    formulaCount = serializers.SerializerMethodField()
    validationRuleCount = serializers.SerializerMethodField()

    class Meta:
        model = RegulatoryReport
        fields = [
            'ReturnKey',
            'Code',
            'Title',
            'Category',
            'department',
            'Frequency',
            'InstCode',
            'FinYear',
            'StartDate',
            'EndDate',
            'Description',
            'itemCount',
            'dynamicAreaCount',
            'formulaCount',
            'validationRuleCount',
        ]

    def get_department(self, obj):
        return obj.department.name if obj.department else ""

    def get_itemCount(self, obj):
        return len(obj.return_items_list) if obj.return_items_list else 0

    def get_dynamicAreaCount(self, obj):
        return len(obj.dynamic_items_list) if obj.dynamic_items_list else 0

    def get_formulaCount(self, obj):
        return len(obj.formulas) if obj.formulas else 0

    def get_validationRuleCount(self, obj):
        return len(obj.validation_rules) if obj.validation_rules else 0

class RegulatoryReportDetailSerializer(serializers.ModelSerializer):
    ReturnKey = serializers.CharField(source='return_key')
    Code = serializers.CharField(source='code')
    Title = serializers.CharField(source='title')
    Category = serializers.CharField(source='category')
    Frequency = serializers.CharField(source='frequency')
    InstCode = serializers.CharField(source='inst_code')
    FinYear = serializers.IntegerField(source='fin_year')
    StartDate = serializers.CharField(source='start_date')
    EndDate = serializers.CharField(source='end_date')
    Description = serializers.CharField(source='description')
    department = serializers.SerializerMethodField()
    ReturnItemsList = serializers.JSONField(source='return_items_list')
    DynamicItemsList = serializers.JSONField(source='dynamic_items_list')
    Formulas = serializers.JSONField(source='formulas')
    ValidationRules = serializers.JSONField(source='validation_rules')

    class Meta:
        model = RegulatoryReport
        fields = [
            'ReturnKey',
            'Code',
            'Title',
            'Category',
            'Frequency',
            'InstCode',
            'FinYear',
            'StartDate',
            'EndDate',
            'Description',
            'department',
            'ReturnItemsList',
            'DynamicItemsList',
            'Formulas',
            'ValidationRules',
        ]

    def get_department(self, obj):
        return obj.department.name if obj.department else ""
