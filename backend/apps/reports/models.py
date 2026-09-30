from django.db import models
from django.utils import timezone
import uuid
from apps.departments.models import Department

class RegulatoryReport(models.Model):
    """
    Authoritative NBE Regulatory Report Template (Compatibility Model).
    Covers all 24 statutory returns required by National Bank of Ethiopia.
    """
    return_key = models.CharField(max_length=64, primary_key=True)  # e.g. 'M_LCPLC001'
    code = models.CharField(max_length=64, db_index=True)
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=128)
    frequency = models.CharField(max_length=32)  # MONTHLY, QUARTERLY, ANNUAL
    inst_code = models.CharField(max_length=32, default='0000013')
    fin_year = models.IntegerField(default=2026)
    start_date = models.CharField(max_length=64)
    end_date = models.CharField(max_length=64)
    description = models.TextField(blank=True)
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reports'
    )
    return_items_list = models.JSONField(default=list, blank=True)
    dynamic_items_list = models.JSONField(default=list, blank=True)
    formulas = models.JSONField(default=list, blank=True)
    validation_rules = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['return_key']
        verbose_name = 'Regulatory Report (Legacy)'
        verbose_name_plural = 'Regulatory Reports (Legacy)'

    def __str__(self):
        return f"{self.title} ({self.return_key})"


class ReportDefinition(models.Model):
    """
    Authoritative Report Definition SSOT entity.
    Maintains report identity across multiple historical versions without
    destructive schema overwrites.
    """
    FREQUENCY_CHOICES = [
        ('MONTHLY', 'Monthly Statutory Return'),
        ('QUARTERLY', 'Quarterly Statutory Return'),
        ('ANNUAL', 'Annual Statutory Return'),
        ('ON_DEMAND', 'Ad-hoc / On-Demand Examination Return'),
    ]

    STATUS_CHOICES = [
        ('ACTIVE', 'Active Regulatory Return'),
        ('INACTIVE', 'Temporarily Inactive'),
        ('DECOMMISSIONED', 'Decommissioned by Central Bank Circular'),
        ('DRAFT', 'Draft Template Definition'),
    ]

    id = models.CharField(max_length=64, primary_key=True)  # e.g. 'REP_M_LCPLC001'
    return_key = models.CharField(max_length=64, unique=True, db_index=True)  # e.g. 'M_LCPLC001'
    code = models.CharField(max_length=64, db_index=True)  # e.g. 'LCPLC001'
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=128)
    frequency = models.CharField(max_length=32, choices=FREQUENCY_CHOICES, default='MONTHLY')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)
    inst_code = models.CharField(max_length=32, default='0000013')
    fin_year = models.IntegerField(default=2026)
    
    # Ownership SSOT
    default_department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='defined_reports'
    )

    # NBE Gateway Mapping & Display
    nbe_mapping = models.JSONField(default=dict, blank=True)
    display_configuration = models.JSONField(default=dict, blank=True)

    # Active version pointer
    current_version_number = models.PositiveIntegerField(default=1)

    effective_from = models.DateTimeField(default=timezone.now)
    effective_to = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['return_key']
        verbose_name = 'Report Definition'
        verbose_name_plural = 'Report Definitions'

    def __str__(self):
        return f"{self.name} ({self.return_key}) [v{self.current_version_number}]"

    def get_active_version(self):
        return self.versions.filter(status='ACTIVE').order_by('-version_number').first()


class ReportVersion(models.Model):
    """
    Immutable Version of a Regulatory Report Schema.
    Ensures historical submissions stay permanently anchored to their original version.
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'Active Version for Current Submissions'),
        ('SUPERSEDED', 'Superseded by Newer Circular/Version'),
        ('DRAFT', 'Draft Version under Preparation'),
        ('RETIRED', 'Retired Version'),
    ]

    id = models.CharField(max_length=128, primary_key=True)  # e.g. 'REP_M_LCPLC001_v1'
    report_definition = models.ForeignKey(
        ReportDefinition,
        on_delete=models.CASCADE,
        related_name='versions'
    )
    version_number = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)
    
    effective_from = models.DateTimeField(default=timezone.now)
    effective_to = models.DateTimeField(null=True, blank=True)

    # Complete snapshot of canonical schema (items, formulas, validations, dynamic areas)
    schema_snapshot = models.JSONField(default=dict)
    changelog_summary = models.TextField(blank=True)
    change_diff = models.JSONField(default=list, blank=True)
    
    created_by = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['report_definition', '-version_number']
        unique_together = ('report_definition', 'version_number')
        verbose_name = 'Report Version'
        verbose_name_plural = 'Report Versions'

    def __str__(self):
        return f"{self.report_definition.return_key} - Version {self.version_number} ({self.status})"


class ReportSection(models.Model):
    """
    Logical grouping of return items within a specific report version.
    """
    id = models.CharField(max_length=128, primary_key=True, default=uuid.uuid4)
    report_version = models.ForeignKey(
        ReportVersion,
        on_delete=models.CASCADE,
        related_name='sections'
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)
    is_repeating = models.BooleanField(default=False)

    class Meta:
        ordering = ['report_version', 'order']
        verbose_name = 'Report Section'
        verbose_name_plural = 'Report Sections'

    def __str__(self):
        return f"{self.report_version.id} - Section: {self.title}"


class ReportField(models.Model):
    """
    Detailed metadata for a single fixed return item / cell.
    """
    DATA_TYPE_CHOICES = [
        ('NUMERIC', 'Numeric / Decimal ETB Amount'),
        ('STRING', 'Alphanumeric String'),
        ('DATE', 'ISO 8601 Date'),
        ('PERCENTAGE', 'Percentage Rate (0 - 100%)'),
        ('CURRENCY', 'Foreign / Local Currency Code'),
        ('BOOLEAN', 'Boolean True / False'),
    ]

    id = models.CharField(max_length=128, primary_key=True, default=uuid.uuid4)
    report_version = models.ForeignKey(
        ReportVersion,
        on_delete=models.CASCADE,
        related_name='fields'
    )
    section = models.ForeignKey(
        ReportSection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fields'
    )
    item_id = models.CharField(max_length=64)
    item_code = models.CharField(max_length=64, db_index=True)
    item_description = models.TextField()
    data_type = models.CharField(max_length=32, choices=DATA_TYPE_CHOICES, default='NUMERIC')
    is_required = models.BooleanField(default=True)
    is_calculated = models.BooleanField(default=False)
    formula_expression = models.TextField(blank=True)
    validation_rules = models.JSONField(default=list, blank=True)
    order = models.PositiveIntegerField(default=0)
    display_config = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['report_version', 'order']
        unique_together = ('report_version', 'item_code')
        verbose_name = 'Report Field'
        verbose_name_plural = 'Report Fields'

    def __str__(self):
        return f"{self.item_code}: {self.item_description}"


class ReportColumn(models.Model):
    """
    Metadata for dynamic repeatable schedules (e.g. Borrower Schedule, Foreclosed Assets).
    """
    id = models.CharField(max_length=128, primary_key=True, default=uuid.uuid4)
    report_version = models.ForeignKey(
        ReportVersion,
        on_delete=models.CASCADE,
        related_name='columns'
    )
    column_key = models.CharField(max_length=64)
    header_label = models.CharField(max_length=255)
    data_type = models.CharField(max_length=32, default='STRING')
    is_required = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    width = models.CharField(max_length=32, blank=True)

    class Meta:
        ordering = ['report_version', 'order']
        verbose_name = 'Report Column'
        verbose_name_plural = 'Report Columns'

    def __str__(self):
        return f"{self.header_label} ({self.column_key})"


class ReportRow(models.Model):
    """
    Fixed row hierarchy or row codes for structured returns.
    """
    id = models.CharField(max_length=128, primary_key=True, default=uuid.uuid4)
    report_version = models.ForeignKey(
        ReportVersion,
        on_delete=models.CASCADE,
        related_name='rows'
    )
    row_code = models.CharField(max_length=64)
    line_number = models.PositiveIntegerField(default=0)
    description = models.TextField()
    parent_row_code = models.CharField(max_length=64, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['report_version', 'order']
        verbose_name = 'Report Row'
        verbose_name_plural = 'Report Rows'

    def __str__(self):
        return f"Row {self.row_code}: {self.description}"
