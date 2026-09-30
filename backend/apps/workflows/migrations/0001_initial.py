# Generated for workflows Submission, WorkflowDefinition, WorkflowStep

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Submission',
            fields=[
                ('id', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('report_key', models.CharField(db_index=True, max_length=64)),
                ('period_year', models.IntegerField(default=2026)),
                ('period_quarter', models.IntegerField(blank=True, null=True)),
                ('period_month', models.IntegerField(blank=True, null=True)),
                ('status', models.CharField(choices=[('DRAFT', 'Maker Draft'), ('PENDING_CHECKER', 'Submitted for Checker Review'), ('APPROVED', 'Checker Approved (Ready for NBE)'), ('REJECTED', 'Checker Rejected'), ('CORRECTION_REQUIRED', 'Correction Requested by Checker'), ('SENDING', 'Transmitting to NBE Gateway'), ('SENT', 'Successfully Delivered to NBE'), ('FAILED', 'Delivery Failed')], db_index=True, default='DRAFT', max_length=32)),
                ('version', models.IntegerField(default=1)),
                ('maker_id', models.CharField(max_length=64)),
                ('maker_name', models.CharField(max_length=255)),
                ('maker_dept', models.CharField(max_length=255)),
                ('checker_id', models.CharField(blank=True, max_length=64)),
                ('checker_name', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('submitted_at', models.DateTimeField(blank=True, null=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('delivered_at', models.DateTimeField(blank=True, null=True)),
                ('nbe_submission_id', models.CharField(blank=True, max_length=128)),
                ('nbe_correlation_id', models.CharField(blank=True, max_length=128)),
                ('nbe_response', models.JSONField(blank=True, null=True)),
                ('values', models.JSONField(blank=True, default=dict)),
                ('dynamic_rows', models.JSONField(blank=True, default=dict)),
                ('validation_summary', models.JSONField(blank=True, default=dict)),
                ('comments', models.JSONField(blank=True, default=list)),
                ('snapshots', models.JSONField(blank=True, default=list)),
            ],
            options={
                'verbose_name': 'Report Submission',
                'verbose_name_plural': 'Report Submissions',
                'ordering': ['-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='WorkflowDefinition',
            fields=[
                ('id', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=64, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('version', models.PositiveIntegerField(default=1)),
                ('is_active', models.BooleanField(default=True)),
                ('applicable_reports', models.JSONField(blank=True, default=list)),
                ('applicable_departments', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Workflow Definition',
                'verbose_name_plural': 'Workflow Definitions',
                'ordering': ['code'],
            },
        ),
        migrations.CreateModel(
            name='WorkflowStep',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=64, primary_key=True, serialize=False)),
                ('step_number', models.PositiveIntegerField()),
                ('name', models.CharField(max_length=255)),
                ('state_code', models.CharField(max_length=32)),
                ('allowed_roles', models.JSONField(default=list)),
                ('permitted_actions', models.JSONField(default=list)),
                ('requires_biometric', models.BooleanField(default=False)),
                ('timeout_hours', models.PositiveIntegerField(default=24)),
                ('workflow', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='steps', to='workflows.workflowdefinition')),
            ],
            options={
                'verbose_name': 'Workflow Step',
                'verbose_name_plural': 'Workflow Steps',
                'ordering': ['workflow', 'step_number'],
                'unique_together': {('workflow', 'step_number')},
            },
        ),
    ]
