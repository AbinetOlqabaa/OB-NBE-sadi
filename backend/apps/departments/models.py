from django.db import models

class Department(models.Model):
    """
    Oromia Bank Business Department Definition.
    Enforces strict departmental ownership of NBE Regulatory Returns.
    """
    id = models.CharField(max_length=64, primary_key=True)  # e.g. 'dept_credit_ops'
    name = models.CharField(max_length=255, unique=True)
    short_code = models.CharField(max_length=32, unique=True)
    division = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    primary_responsibilities = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'

    def __str__(self):
        return f"{self.name} ({self.short_code})"

    @property
    def report_keys(self):
        # Retrieved dynamically from mapped reports
        return list(self.reports.values_list('return_key', flat=True))
