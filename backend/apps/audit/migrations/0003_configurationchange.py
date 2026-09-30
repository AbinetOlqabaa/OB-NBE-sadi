# Generated for audit ConfigurationChange

from django.db import migrations, models
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('audit', '0002_auditevidence_auditfinding_auditreportpackage_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ConfigurationChange',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=64, primary_key=True, serialize=False)),
                ('timestamp', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('actor_id', models.CharField(max_length=64)),
                ('actor_name', models.CharField(max_length=255)),
                ('actor_role', models.CharField(max_length=32)),
                ('entity_type', models.CharField(choices=[('DEPARTMENT', 'Department Hierarchy & Identity'), ('REPORT_DEFINITION', 'Regulatory Report Definition'), ('REPORT_VERSION', 'Report Version & Schema Snapshot'), ('ROLE', 'System Role & Privilege Set'), ('PERMISSION', 'Granular Permission'), ('ASSIGNMENT', 'Department or User Report Assignment'), ('SPECIAL_ACCESS', 'Special Access Grant Delegation'), ('WORKFLOW', 'Workflow Definition or Step')], db_index=True, max_length=32)),
                ('entity_id', models.CharField(db_index=True, max_length=128)),
                ('entity_name', models.CharField(blank=True, max_length=255)),
                ('action', models.CharField(db_index=True, max_length=64)),
                ('summary', models.CharField(max_length=512)),
                ('details', models.TextField(blank=True)),
                ('diff', models.JSONField(blank=True, default=list)),
                ('old_state', models.JSONField(blank=True, null=True)),
                ('new_state', models.JSONField(blank=True, null=True)),
                ('reason', models.TextField(blank=True)),
                ('correlation_id', models.CharField(blank=True, max_length=128)),
            ],
            options={
                'verbose_name': 'Configuration Change Audit',
                'verbose_name_plural': 'Configuration Change Audits',
                'ordering': ['-timestamp'],
            },
        ),
    ]
