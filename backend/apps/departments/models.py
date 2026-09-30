from django.db import models
from django.utils import timezone
import uuid

class Department(models.Model):
    """
    Oromia Bank Business Department Definition.
    Supports dynamic organizational hierarchy, parent-child reporting,
    and lifecycle effective dates for institutional agility.
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'Active Operational Department'),
        ('INACTIVE', 'Inactive / Deprecated Department'),
        ('RESTRUCTURED', 'Restructured / Merged Department'),
        ('PLANNED', 'Planned Future Unit'),
    ]

    id = models.CharField(max_length=64, primary_key=True)  # e.g. 'dept_credit_ops'
    name = models.CharField(max_length=255, unique=True)
    short_code = models.CharField(max_length=32, unique=True)
    division = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # Hierarchy SSOT
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children'
    )
    hierarchy_level = models.PositiveIntegerField(default=1)  # 0: Division, 1: Dept, 2: Unit/Section
    path = models.CharField(max_length=512, blank=True, db_index=True)  # e.g. '/div_banking/dept_credit_ops'
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)
    
    primary_responsibilities = models.JSONField(default=list, blank=True)
    
    # Time-aware governance
    effective_from = models.DateTimeField(default=timezone.now)
    effective_to = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['hierarchy_level', 'name']
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'

    def __str__(self):
        return f"{self.name} ({self.short_code})"

    @property
    def report_keys(self):
        # Retrieved dynamically from mapped reports and explicit assignments
        assigned = list(self.report_assignments.filter(is_active=True).values_list('report_key', flat=True))
        if assigned:
            return assigned
        if hasattr(self, 'reports'):
            return list(self.reports.values_list('return_key', flat=True))
        return []

    def get_ancestors(self):
        ancestors = []
        curr = self.parent
        while curr:
            ancestors.append(curr)
            curr = curr.parent
        return ancestors

    def get_descendants(self):
        descendants = []
        for child in self.children.all():
            descendants.append(child)
            descendants.extend(child.get_descendants())
        return descendants


class DepartmentReportAssignment(models.Model):
    """
    Explicit, auditable, and time-aware relationship entity binding a
    Department to a Regulatory Return.
    """
    ROLE_CHOICES = [
        ('PRIMARY_OWNER', 'Primary Originating & Drafting Department'),
        ('CONTRIBUTOR', 'Contributing Department (Dynamic Schedules)'),
        ('REVIEWER', 'Reviewing / Sign-off Department'),
        ('SUPERVISORY', 'Supervisory / Oversight Department'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4)
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='report_assignments'
    )
    report_key = models.CharField(max_length=64, db_index=True)
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default='PRIMARY_OWNER')
    is_active = models.BooleanField(default=True, db_index=True)
    effective_from = models.DateTimeField(default=timezone.now)
    effective_to = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    assigned_by = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['department', 'report_key', 'role']
        unique_together = ('department', 'report_key', 'role')
        verbose_name = 'Department Report Assignment'
        verbose_name_plural = 'Department Report Assignments'

    def __str__(self):
        return f"{self.department.short_code} -> {self.report_key} ({self.role})"
