from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .gateway_service import NbeGatewayService

class GatewayHealthView(APIView):
    def get(self, request):
        status_code, body = NbeGatewayService.proxy_to_simulator('GET', 'gateway-health')
        return Response(body, status=status_code)

class GatewaySubmitView(APIView):
    def post(self, request):
        status_code, body = NbeGatewayService.proxy_to_simulator(
            method='POST',
            path='submit',
            data=request.data,
            headers=request.headers
        )
        return Response(body, status=status_code)

class GatewayScenarioView(APIView):
    def get(self, request):
        status_code, body = NbeGatewayService.proxy_to_simulator('GET', 'scenario')
        return Response(body, status=status_code)

    def post(self, request):
        status_code, body = NbeGatewayService.proxy_to_simulator('POST', 'scenario', data=request.data)
        return Response(body, status=status_code)

class GatewaySubmissionsListView(APIView):
    def get(self, request):
        status_code, body = NbeGatewayService.proxy_to_simulator('GET', 'submissions')
        return Response(body, status=status_code)

class GatewayLogsListView(APIView):
    def get(self, request):
        status_code, body = NbeGatewayService.proxy_to_simulator('GET', 'logs')
        return Response(body, status=status_code)

    def delete(self, request):
        status_code, body = NbeGatewayService.proxy_to_simulator('DELETE', 'logs')
        return Response(body, status=status_code)
