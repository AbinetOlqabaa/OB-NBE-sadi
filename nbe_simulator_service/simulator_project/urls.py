from django.urls import path, include
from rest_framework.views import APIView
from rest_framework.response import Response

class SimulatorRootInfoView(APIView):
    def get(self, request):
        return Response({
            'service': 'National Bank of Ethiopia (NBE) BSD Intake Gateway Simulator',
            'version': '1.0.0',
            'architecture': 'Independent Django Microservice',
            'port': 8001,
            'directives': ['NBE BSD/03/2020', 'SBR/2026'],
            'supportedReportsCount': 24,
            'primaryEndpoints': {
                'intake': 'POST /api/v1/nbe-simulator/submit',
                'centralBankParity': 'POST /api/v2/regulatory/gateway',
                'scenarioControl': 'GET/POST /api/v1/nbe-simulator/scenario',
                'gatewayHealth': 'GET /api/v1/nbe-simulator/gateway-health',
                'submissions': 'GET /api/v1/nbe-simulator/submissions',
                'logs': 'GET/DELETE /api/v1/nbe-simulator/logs',
                'reportsCatalog': 'GET /api/v1/nbe-simulator/report-definitions',
            }
        })

urlpatterns = [
    path('', SimulatorRootInfoView.as_view(), name='simulator-root-info'),
    path('api/', include('apps.simulator.urls')),
]
