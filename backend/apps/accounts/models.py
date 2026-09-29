from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone
import uuid

class UserAccountManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email address is mandatory for Oromia Bank users.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'ADMIN')
        extra_fields.setdefault('status', 'ACTIVE')
        extra_fields.setdefault('department', 'Compliance & Legal Governance')
        extra_fields.setdefault('employee_id', f"OB-SU-{uuid.uuid4().hex[:6].upper()}")
        return self.create_user(email, password, **extra_fields)

class UserAccount(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('ADMIN', 'Compliance Administrator'),
        ('MAKER', 'Regulatory Reporting Maker'),
        ('CHECKER', 'Four-Eyes Regulatory Checker'),
        ('AUDITOR', 'Internal Compliance Auditor'),
    ]

    STATUS_CHOICES = [
        ('ACTIVE', 'Active Account'),
        ('PENDING_APPROVAL', 'Pending Compliance Approval'),
        ('DISABLED', 'Disabled Account'),
    ]

    id = models.CharField(max_length=64, primary_key=True)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True, db_index=True)
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default='MAKER')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='ACTIVE')
    institution_code = models.CharField(max_length=32, default='0000013')
    department = models.CharField(max_length=255)
    employee_id = models.CharField(max_length=64, unique=True)
    phone_number = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.CharField(max_length=255, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects = UserAccountManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name', 'role', 'department', 'employee_id']

    class Meta:
        ordering = ['name']
        verbose_name = 'User Account'
        verbose_name_plural = 'User Accounts'

    def __str__(self):
        return f"{self.name} ({self.email}) - {self.role} [{self.department}]"

class BiometricCredential(models.Model):
    TYPE_CHOICES = [
        ('FINGERPRINT', 'Touch ID / Fingerprint Sensor'),
        ('FACE', 'Face ID / Facial Recognition Sensor'),
    ]

    user = models.ForeignKey(UserAccount, on_delete=models.CASCADE, related_name='biometric_credentials')
    type = models.CharField(max_length=32, choices=TYPE_CHOICES)
    credential_id = models.CharField(max_length=255, db_index=True)
    device_label = models.CharField(max_length=255, blank=True)
    face_hash = models.TextField(blank=True)
    public_key = models.TextField(blank=True)
    enrolled_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-enrolled_at']
        unique_together = ('user', 'type', 'credential_id')

class OtpVerification(models.Model):
    PURPOSE_CHOICES = [
        ('REGISTRATION', 'Registration Verification'),
        ('PASSWORD_RESET', 'Password Reset Verification'),
    ]

    email = models.EmailField(db_index=True)
    code = models.CharField(max_length=16)
    purpose = models.CharField(max_length=32, choices=PURPOSE_CHOICES, default='REGISTRATION')
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']

    def is_valid(self, code_input):
        if self.used:
            return False
        if timezone.now() > self.expires_at:
            return False
        return self.code.strip() == code_input.strip()
