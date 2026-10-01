# Generated manually for notifications Notification model

from django.db import migrations, models
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=64, primary_key=True, serialize=False)),
                ('user_id', models.CharField(db_index=True, max_length=64)),
                ('title', models.CharField(max_length=255)),
                ('message', models.TextField()),
                ('level', models.CharField(choices=[('INFO', 'Informational Notice'), ('SUCCESS', 'Success Confirmation'), ('WARNING', 'Warning / Action Required'), ('ERROR', 'Error / Critical Alert')], default='INFO', max_length=32)),
                ('read', models.BooleanField(default=False)),
                ('action_url', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                'verbose_name': 'Notification',
                'verbose_name_plural': 'Notifications',
                'ordering': ['-created_at'],
            },
        ),
    ]
