from django.urls import path
from .views import (
    GatewayHealthView,
    GatewaySubmitView,
    GatewayScenarioView,
    GatewaySubmissionsListView,
    GatewayLogsListView,
)

urlpatterns = [
    path('nbe-simulator/gateway-health', GatewayHealthView.as_view(), name='gateway-health'),
    path('nbe-simulator/submit', GatewaySubmitView.as_view(), name='gateway-submit'),
    path('nbe-simulator/scenario', GatewayScenarioView.as_view(), name='gateway-scenario'),
    path('nbe-simulator/submissions', GatewaySubmissionsListView.as_view(), name='gateway-submissions'),
    path('nbe-simulator/logs', GatewayLogsListView.as_view(), name='gateway-logs'),
]
