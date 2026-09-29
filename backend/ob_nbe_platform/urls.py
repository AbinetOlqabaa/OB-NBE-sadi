from django.contrib import admin
from django.urls import path, include
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.reports.models import RegulatoryReport
from apps.workflows.models import Submission

class SystemHealthView(APIView):
    def get(self, request):
        return Response({
            'status': 'ONLINE',
            'service': 'Oromia Bank NBE Platform (Django Engine)',
            'backend': 'Django 5.2 + Django REST Framework',
            'institutionCode': '0000013',
            'registeredReportsCount': RegulatoryReport.objects.count(),
            'activeSubmissionsCount': Submission.objects.count(),
            'database': 'SQLite Persistent Store (db.sqlite3)',
            'directives': ['NBE BSD/03/2020', 'SBR/2026'],
        })

class ApiDocumentationView(APIView):
    def get(self, request):
        return Response({
            'title': 'Oromia Bank NBE Regulatory Platform - Django API Documentation',
            'version': '2.0.0',
            'compliance': 'NBE Directive BSD/03/2020',
            'endpoints': {
                'authentication': [
                    'POST /api/auth/login',
                    'POST /api/auth/register',
                    'POST /api/auth/otp/send',
                    'POST /api/auth/otp/verify',
                    'POST /api/auth/reset-password',
                    'POST /api/auth/biometrics/register',
                    'POST /api/auth/biometrics/verify',
                    'GET /api/auth/biometrics/status/<email>',
                    'GET /api/auth/seed-data',
                    'POST /api/auth/seed-data/reset'
                ],
                'users': [
                    'GET /api/users',
                    'PUT /api/users/<id>',
                    'POST /api/users/<id>/status',
                    'DELETE /api/users/<id>'
                ],
                'departments': [
                    'GET /api/departments',
                    'GET /api/departments/<id>'
                ],
                'permissions': [
                    'POST /api/users/<id>/special-access',
                    'DELETE /api/users/<id>/special-access/<grant_id>'
                ],
                'reports': [
                    'GET /api/regulatory/templates',
                    'GET /api/regulatory/templates/<key>'
                ],
                'workflows': [
                    'GET /api/regulatory/submissions',
                    'GET /api/regulatory/submissions/<id>',
                    'POST /api/regulatory/submissions',
                    'PUT /api/regulatory/submissions/<id>',
                    'POST /api/regulatory/submissions/<id>/validate',
                    'POST /api/regulatory/submissions/<id>/submit',
                    'POST /api/regulatory/submissions/<id>/review',
                    'POST /api/regulatory/submissions/<id>/deliver',
                    'POST /api/regulatory/submissions/batch-sync',
                    'GET /api/regulatory/submissions/<id>/export/xlsx'
                ],
                'audit': [
                    'GET /api/audit-logs',
                    'POST /api/audit-logs',
                    'POST /api/audit-logs/biometric',
                    'POST /api/audit-logs/batch'
                ],
                'notifications': [
                    'GET /api/notifications',
                    'POST /api/notifications/<id>/read',
                    'DELETE /api/notifications/clear'
                ],
                'nbe_gateway': [
                    'GET /api/nbe-simulator/gateway-health',
                    'POST /api/nbe-simulator/submit',
                    'GET /api/nbe-simulator/scenario',
                    'POST /api/nbe-simulator/scenario',
                    'GET /api/nbe-simulator/submissions',
                    'GET /api/nbe-simulator/logs',
                    'DELETE /api/nbe-simulator/logs'
                ]
            }
        })

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health', SystemHealthView.as_view(), name='system-health'),
    path('api/docs', ApiDocumentationView.as_view(), name='api-docs'),

    # Modular Applications
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.departments.urls')),
    path('api/', include('apps.permissions.urls')),
    path('api/', include('apps.reports.urls')),
    path('api/', include('apps.workflows.urls')),
    path('api/', include('apps.audit.urls')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/v1/audit/', include('apps.audit.urls')),
    path('api/', include('apps.notifications.urls')),
    path('api/', include('apps.nbe_gateway.urls')),
]
