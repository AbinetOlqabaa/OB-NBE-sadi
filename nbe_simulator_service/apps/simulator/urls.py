from django.urls import path
from .views import (
    IntakeSubmitView,
    ScenarioConfigView,
    GatewayHealthView,
    SubmissionsListView,
    RequestLogsView,
    ReportDefinitionsCatalogView,
    ResetSimulatorView,
)

urlpatterns = [
    # v1 Simulator API
    path('v1/nbe-simulator/submit', IntakeSubmitView.as_view(), name='simulator-submit-v1'),
    path('v1/nbe-simulator/scenario', ScenarioConfigView.as_view(), name='simulator-scenario-v1'),
    path('v1/nbe-simulator/gateway-health', GatewayHealthView.as_view(), name='simulator-health-v1'),
    path('v1/nbe-simulator/submissions', SubmissionsListView.as_view(), name='simulator-submissions-v1'),
    path('v1/nbe-simulator/logs', RequestLogsView.as_view(), name='simulator-logs-v1'),
    path('v1/nbe-simulator/report-definitions', ReportDefinitionsCatalogView.as_view(), name='simulator-reports-v1'),
    path('v1/nbe-simulator/reset', ResetSimulatorView.as_view(), name='simulator-reset-v1'),

    # Real Central Bank production parity endpoint: POST https://nbe.gov.et/api/v2/regulatory/gateway
    path('v2/regulatory/gateway', IntakeSubmitView.as_view(), name='central-bank-gateway-parity'),
    path('v2/regulatory/health', GatewayHealthView.as_view(), name='central-bank-health-parity'),

    # Convenience paths without version prefix
    path('nbe-simulator/submit', IntakeSubmitView.as_view(), name='simulator-submit-alias'),
    path('nbe-simulator/scenario', ScenarioConfigView.as_view(), name='simulator-scenario-alias'),
    path('nbe-simulator/gateway-health', GatewayHealthView.as_view(), name='simulator-health-alias'),
    path('nbe-simulator/submissions', SubmissionsListView.as_view(), name='simulator-submissions-alias'),
    path('nbe-simulator/logs', RequestLogsView.as_view(), name='simulator-logs-alias'),
    path('nbe-simulator/report-definitions', ReportDefinitionsCatalogView.as_view(), name='simulator-reports-alias'),
    path('nbe-simulator/reset', ResetSimulatorView.as_view(), name='simulator-reset-alias'),
]
