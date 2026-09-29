from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from .models import SimulatorScenario, SimulatorSubmission, SimulatorRequestLog
from .serializers import (
    SimulatorScenarioSerializer,
    SimulatorSubmissionSerializer,
    SimulatorRequestLogSerializer,
)
from .engine import SimulatorEngine
from .validator import SUPPORTED_NBE_REPORTS

class IntakeSubmitView(APIView):
    """
    Primary statutory return intake endpoint for National Bank of Ethiopia BSD.
    Exposed at:
    - POST /api/v1/nbe-simulator/submit
    - POST /api/v2/regulatory/gateway (production parity alias)
    """
    def post(self, request):
        status_code, body, resp_headers = SimulatorEngine.process_intake(
            payload=request.data,
            headers=request.headers,
            query_params=request.query_params
        )
        response = Response(body, status=status_code)
        for k, v in resp_headers.items():
            response[k] = v
        return response


class ScenarioConfigView(APIView):
    """
    Configuration of simulator behavior scenario.
    GET /api/v1/nbe-simulator/scenario
    POST /api/v1/nbe-simulator/scenario
    """
    def get(self, request):
        scenario = SimulatorScenario.get_current()
        return Response(SimulatorScenarioSerializer(scenario).data)

    def post(self, request):
        scenario = SimulatorScenario.get_current()
        data = request.data

        if 'mode' in data:
            valid_modes = [c[0] for c in SimulatorScenario.MODE_CHOICES]
            if data['mode'] not in valid_modes:
                return Response(
                    {'error': f"Invalid mode '{data['mode']}'. Must be one of {valid_modes}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            scenario.mode = data['mode']

        if 'latencyMs' in data:
            scenario.latency_ms = max(0, int(data['latencyMs']))

        if 'flakyFailureRate' in data:
            scenario.flaky_failure_rate = min(1.0, max(0.0, float(data['flakyFailureRate'])))

        if 'failureMessage' in data:
            scenario.failure_message = str(data['failureMessage'])

        scenario.save()
        return Response(SimulatorScenarioSerializer(scenario).data)


class GatewayHealthView(APIView):
    """
    Central Bank Gateway health telemetry probe.
    GET /api/v1/nbe-simulator/gateway-health
    """
    def get(self, request):
        scenario = SimulatorScenario.get_current()
        is_healthy = scenario.mode not in ('SERVER_ERROR', 'TIMEOUT')
        status_str = (
            'DEGRADED'
            if scenario.mode in ('SERVER_ERROR', 'TIMEOUT', 'RANDOM_FLAKY')
            else 'ONLINE'
        )

        return Response({
            'status': status_str,
            'healthy': is_healthy,
            'gateway': 'National Bank of Ethiopia (NBE) BSD Gateway',
            'endpoint': 'https://nbe.gov.et/api/v2/regulatory/gateway',
            'institutionCode': '0000013',
            'institutionName': 'Oromia Bank S.C.',
            'latencyMs': scenario.latency_ms,
            'tlsVersion': 'TLSv1.3 / mTLS',
            'directives': ['BSD/03/2020', 'SBR/2026'],
            'mode': scenario.mode,
            'supportedReportsCount': len(SUPPORTED_NBE_REPORTS),
            'timestamp': timezone.now().isoformat(),
        })


class SubmissionsListView(APIView):
    """
    Submissions received by the simulator.
    GET /api/v1/nbe-simulator/submissions
    """
    def get(self, request):
        limit = int(request.query_params.get('limit', 100))
        subs = SimulatorSubmission.objects.all()[:limit]
        return Response(SimulatorSubmissionSerializer(subs, many=True).data)


class RequestLogsView(APIView):
    """
    Request/Response audit trail logs.
    GET /api/v1/nbe-simulator/logs
    DELETE /api/v1/nbe-simulator/logs
    """
    def get(self, request):
        limit = int(request.query_params.get('limit', 100))
        logs = SimulatorRequestLog.objects.all()[:limit]
        return Response(SimulatorRequestLogSerializer(logs, many=True).data)

    def delete(self, request):
        SimulatorRequestLog.objects.all().delete()
        return Response({'success': True, 'message': 'Simulator logs cleared'})


class ReportDefinitionsCatalogView(APIView):
    """
    Catalog of all 24 NBE Statutory Returns supported by the simulator.
    GET /api/v1/nbe-simulator/report-definitions
    """
    def get(self, request):
        catalog = [
            {
                'returnKey': k,
                'title': v['title'],
                'frequency': v['freq'],
                'institutionCode': '0000013',
                'regulatoryBody': 'National Bank of Ethiopia (Bank Supervision Directorate)',
                'directives': ['BSD/03/2020'],
            }
            for k, v in SUPPORTED_NBE_REPORTS.items()
        ]
        return Response({
            'count': len(catalog),
            'reports': catalog,
        })


class ResetSimulatorView(APIView):
    """
    Resets the simulator state for deterministic testing.
    POST /api/v1/nbe-simulator/reset
    """
    def post(self, request):
        SimulatorSubmission.objects.all().delete()
        SimulatorRequestLog.objects.all().delete()
        scenario = SimulatorScenario.get_current()
        scenario.mode = 'ALWAYS_SUCCESS'
        scenario.latency_ms = 0
        scenario.failure_message = ''
        scenario.flaky_failure_rate = 0.30
        scenario.save()
        return Response({
            'success': True,
            'message': 'Simulator state reset successfully to ALWAYS_SUCCESS'
        })
