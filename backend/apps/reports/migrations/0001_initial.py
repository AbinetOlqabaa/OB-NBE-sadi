# Generated manually for Django reports app SSOT models

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('departments', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='RegulatoryReport',
            fields=[
                ('return_key', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('code', models.CharField(db_index=True, max_length=64)),
                ('title', models.CharField(max_length=255)),
                ('category', models.CharField(max_length=128)),
                ('frequency', models.CharField(max_length=32)),
                ('inst_code', models.CharField(default='0000013', max_length=32)),
                ('fin_year', models.IntegerField(default=2026)),
                ('start_date', models.CharField(max_length=64)),
                ('end_date', models.CharField(max_length=64)),
                ('description', models.TextField(blank=True)),
                ('return_items_list', models.JSONField(blank=True, default=list)),
                ('dynamic_items_list', models.JSONField(blank=True, default=list)),
                ('formulas', models.JSONField(blank=True, default=list)),
                ('validation_rules', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('department', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reports', to='departments.department')),
            ],
            options={
                'verbose_name': 'Regulatory Report (Legacy)',
                'verbose_name_plural': 'Regulatory Reports (Legacy)',
                'ordering': ['return_key'],
            },
        ),
        migrations.CreateModel(
            name='ReportDefinition',
            fields=[
                ('id', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('return_key', models.CharField(db_index=True, max_length=64, unique=True)),
                ('code', models.CharField(db_index=True, max_length=64)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('category', models.CharField(max_length=128)),
                ('frequency', models.CharField(choices=[('MONTHLY', 'Monthly Statutory Return'), ('QUARTERLY', 'Quarterly Statutory Return'), ('ANNUAL', 'Annual Statutory Return'), ('ON_DEMAND', 'Ad-hoc / On-Demand Examination Return')], default='MONTHLY', max_length=32)),
                ('status', models.CharField(choices=[('ACTIVE', 'Active Regulatory Return'), ('INACTIVE', 'Temporarily Inactive'), ('DECOMMISSIONED', 'Decommissioned by Central Bank Circular'), ('DRAFT', 'Draft Template Definition')], default='ACTIVE', max_length=32)),
                ('inst_code', models.CharField(default='0000013', max_length=32)),
                ('fin_year', models.IntegerField(default=2026)),
                ('nbe_mapping', models.JSONField(blank=True, default=dict)),
                ('display_configuration', models.JSONField(blank=True, default=dict)),
                ('current_version_number', models.PositiveIntegerField(default=1)),
                ('effective_from', models.DateTimeField(default=django.utils.timezone.now)),
                ('effective_to', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('default_department', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='defined_reports', to='departments.department')),
            ],
            options={
                'verbose_name': 'Report Definition',
                'verbose_name_plural': 'Report Definitions',
                'ordering': ['return_key'],
            },
        ),
        migrations.CreateModel(
            name='ReportVersion',
            fields=[
                ('id', models.CharField(max_length=128, primary_key=True, serialize=False)),
                ('version_number', models.PositiveIntegerField(default=1)),
                ('status', models.CharField(choices=[('ACTIVE', 'Active Version for Current Submissions'), ('SUPERSEDED', 'Superseded by Newer Circular/Version'), ('DRAFT', 'Draft Version under Preparation'), ('RETIRED', 'Retired Version')], default='ACTIVE', max_length=32)),
                ('effective_from', models.DateTimeField(default=django.utils.timezone.now)),
                ('effective_to', models.DateTimeField(blank=True, null=True)),
                ('schema_snapshot', models.JSONField(default=dict)),
                ('changelog_summary', models.TextField(blank=True)),
                ('change_diff', models.JSONField(blank=True, default=list)),
                ('created_by', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('report_definition', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='versions', to='reports.reportdefinition')),
            ],
            options={
                'verbose_name': 'Report Version',
                'verbose_name_plural': 'Report Versions',
                'ordering': ['report_definition', '-version_number'],
                'unique_together': {('report_definition', 'version_number')},
            },
        ),
        migrations.CreateModel(
            name='ReportSection',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=128, primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=64)),
                ('title', models.CharField(max_length=255)),
                ('order', models.PositiveIntegerField(default=0)),
                ('description', models.TextField(blank=True)),
                ('is_repeating', models.BooleanField(default=False)),
                ('report_version', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sections', to='reports.reportversion')),
            ],
            options={
                'verbose_name': 'Report Section',
                'verbose_name_plural': 'Report Sections',
                'ordering': ['report_version', 'order'],
            },
        ),
        migrations.CreateModel(
            name='ReportColumn',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=128, primary_key=True, serialize=False)),
                ('column_key', models.CharField(max_length=64)),
                ('header_label', models.CharField(max_length=255)),
                ('data_type', models.CharField(default='STRING', max_length=32)),
                ('is_required', models.BooleanField(default=True)),
                ('order', models.PositiveIntegerField(default=0)),
                ('width', models.CharField(blank=True, max_length=32)),
                ('report_version', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='columns', to='reports.reportversion')),
            ],
            options={
                'verbose_name': 'Report Column',
                'verbose_name_plural': 'Report Columns',
                'ordering': ['report_version', 'order'],
            },
        ),
        migrations.CreateModel(
            name='ReportRow',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=128, primary_key=True, serialize=False)),
                ('row_code', models.CharField(max_length=64)),
                ('line_number', models.PositiveIntegerField(default=0)),
                ('description', models.TextField()),
                ('parent_row_code', models.CharField(blank=True, max_length=64)),
                ('order', models.PositiveIntegerField(default=0)),
                ('report_version', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rows', to='reports.reportversion')),
            ],
            options={
                'verbose_name': 'Report Row',
                'verbose_name_plural': 'Report Rows',
                'ordering': ['report_version', 'order'],
            },
        ),
        migrations.CreateModel(
            name='ReportField',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=128, primary_key=True, serialize=False)),
                ('item_id', models.CharField(max_length=64)),
                ('item_code', models.CharField(db_index=True, max_length=64)),
                ('item_description', models.TextField()),
                ('data_type', models.CharField(choices=[('NUMERIC', 'Numeric / Decimal ETB Amount'), ('STRING', 'Alphanumeric String'), ('DATE', 'ISO 8601 Date'), ('PERCENTAGE', 'Percentage Rate (0 - 100%)'), ('CURRENCY', 'Foreign / Local Currency Code'), ('BOOLEAN', 'Boolean True / False')], default='NUMERIC', max_length=32)),
                ('is_required', models.BooleanField(default=True)),
                ('is_calculated', models.BooleanField(default=False)),
                ('formula_expression', models.TextField(blank=True)),
                ('validation_rules', models.JSONField(blank=True, default=list)),
                ('order', models.PositiveIntegerField(default=0)),
                ('display_config', models.JSONField(blank=True, default=dict)),
                ('report_version', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fields', to='reports.reportversion')),
                ('section', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fields', to='reports.reportsection')),
            ],
            options={
                'verbose_name': 'Report Field',
                'verbose_name_plural': 'Report Fields',
                'ordering': ['report_version', 'order'],
                'unique_together': {('report_version', 'item_code')},
            },
        ),
    ]
