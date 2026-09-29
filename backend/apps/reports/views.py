from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import RegulatoryReport
from .serializers import RegulatoryReportListSerializer, RegulatoryReportDetailSerializer

class RegulatoryTemplateListView(APIView):
    """
    GET: List all 24 regulatory report templates.
    """
    def get(self, request):
        templates = RegulatoryReport.objects.select_related('department').all()
        serializer = RegulatoryReportListSerializer(templates, many=True)
        return Response(serializer.data)

class RegulatoryTemplateDetailView(APIView):
    """
    GET: Retrieve specific report template by ReturnKey.
    """
    def get(self, request, key):
        try:
            report = RegulatoryReport.objects.select_related('department').get(return_key=key)
            serializer = RegulatoryReportDetailSerializer(report)
            return Response(serializer.data)
        except RegulatoryReport.DoesNotExist:
            return Response({'error': f'Template {key} not found'}, status=status.HTTP_404_NOT_FOUND)
