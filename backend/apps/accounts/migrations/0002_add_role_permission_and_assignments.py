# Generated for accounts Role, Permission, UserReportAssignment, DepartmentMember

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('departments', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Permission',
            fields=[
                ('code', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('category', models.CharField(max_length=64)),
                ('description', models.TextField(blank=True)),
            ],
            options={
                'verbose_name': 'Permission',
                'verbose_name_plural': 'Permissions',
                'ordering': ['category', 'code'],
            },
        ),
        migrations.CreateModel(
            name='Role',
            fields=[
                ('code', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('permissions', models.JSONField(blank=True, default=list)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Role Definition',
                'verbose_name_plural': 'Role Definitions',
                'ordering': ['code'],
            },
        ),
        migrations.CreateModel(
            name='DepartmentMember',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=64, primary_key=True, serialize=False)),
                ('is_primary', models.BooleanField(default=True)),
                ('effective_from', models.DateTimeField(default=django.utils.timezone.now)),
                ('effective_to', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='members', to='departments.department')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='department_memberships', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Department Member',
                'verbose_name_plural': 'Department Members',
                'ordering': ['user', '-is_primary'],
                'unique_together': {('user', 'department')},
            },
        ),
        migrations.CreateModel(
            name='UserReportAssignment',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=64, primary_key=True, serialize=False)),
                ('report_key', models.CharField(db_index=True, max_length=64)),
                ('department_id', models.CharField(db_index=True, max_length=64)),
                ('duty', models.CharField(choices=[('MAKER', 'Designated Report Maker / Preparer'), ('CHECKER', 'Designated Report Reviewer / Approver'), ('AUDITOR', 'Assigned Compliance Inspector'), ('VIEWER', 'Read-Only Departmental Viewer')], default='MAKER', max_length=32)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('effective_from', models.DateTimeField(default=django.utils.timezone.now)),
                ('effective_to', models.DateTimeField(blank=True, null=True)),
                ('assigned_by', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='report_assignments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'User Report Assignment',
                'verbose_name_plural': 'User Report Assignments',
                'ordering': ['user', 'report_key', 'duty'],
                'unique_together': {('user', 'report_key', 'duty')},
            },
        ),
    ]
