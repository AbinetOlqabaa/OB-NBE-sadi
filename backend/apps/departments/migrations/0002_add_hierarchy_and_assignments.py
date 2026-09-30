# Generated for departments hierarchy and DepartmentReportAssignment

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('departments', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='department',
            options={'ordering': ['hierarchy_level', 'name'], 'verbose_name': 'Department', 'verbose_name_plural': 'Departments'},
        ),
        migrations.AddField(
            model_name='department',
            name='effective_from',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name='department',
            name='effective_to',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='department',
            name='hierarchy_level',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='department',
            name='parent',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='children', to='departments.department'),
        ),
        migrations.AddField(
            model_name='department',
            name='path',
            field=models.CharField(blank=True, db_index=True, max_length=512),
        ),
        migrations.AddField(
            model_name='department',
            name='status',
            field=models.CharField(choices=[('ACTIVE', 'Active Operational Department'), ('INACTIVE', 'Inactive / Deprecated Department'), ('RESTRUCTURED', 'Restructured / Merged Department'), ('PLANNED', 'Planned Future Unit')], db_index=True, default='ACTIVE', max_length=32),
        ),
        migrations.CreateModel(
            name='DepartmentReportAssignment',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=64, primary_key=True, serialize=False)),
                ('report_key', models.CharField(db_index=True, max_length=64)),
                ('role', models.CharField(choices=[('PRIMARY_OWNER', 'Primary Originating & Drafting Department'), ('CONTRIBUTOR', 'Contributing Department (Dynamic Schedules)'), ('REVIEWER', 'Reviewing / Sign-off Department'), ('SUPERVISORY', 'Supervisory / Oversight Department')], default='PRIMARY_OWNER', max_length=32)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('effective_from', models.DateTimeField(default=django.utils.timezone.now)),
                ('effective_to', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('assigned_by', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='report_assignments', to='departments.department')),
            ],
            options={
                'verbose_name': 'Department Report Assignment',
                'verbose_name_plural': 'Department Report Assignments',
                'ordering': ['department', 'report_key', 'role'],
                'unique_together': {('department', 'report_key', 'role')},
            },
        ),
    ]
