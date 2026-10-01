# Generated manually for permissions SpecialAccessGrant

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SpecialAccessGrant',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=64, primary_key=True, serialize=False)),
                ('report_key', models.CharField(blank=True, db_index=True, max_length=64)),
                ('department', models.CharField(blank=True, max_length=255)),
                ('departments', models.JSONField(blank=True, default=list)),
                ('reason', models.TextField()),
                ('granted_by', models.CharField(max_length=255)),
                ('granted_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('revoked', models.BooleanField(default=False)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('revoked_by', models.CharField(blank=True, max_length=255)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='special_access_grants', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Special Access Grant',
                'verbose_name_plural': 'Special Access Grants',
                'ordering': ['-granted_at'],
            },
        ),
    ]
