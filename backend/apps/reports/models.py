from django.db import models
from apps.departments.models import Department

class RegulatoryReport(models.Model):
    """
    Authoritative NBE Regulatory Report Template.
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
        verbose_name = 'Regulatory Report'
        verbose_name_plural = 'Regulatory Reports'

    def __str__(self):
        return f"{self.title} ({self.return_key})"
