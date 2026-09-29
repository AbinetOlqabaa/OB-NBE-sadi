from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Department
from .serializers import DepartmentSerializer

class DepartmentListView(APIView):
    """
    GET: Returns all registered Oromia Bank departments along with mapped regulatory returns.
    """
    def get(self, request):
        departments = Department.objects.prefetch_related('reports').all()
        serializer = DepartmentSerializer(departments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class DepartmentDetailView(APIView):
    """
    GET: Retrieve details of a specific department by ID.
    """
    def get(self, request, pk):
        try:
            dept = Department.objects.prefetch_related('reports').get(pk=pk)
            return Response(DepartmentSerializer(dept).data)
        except Department.DoesNotExist:
            return Response({'error': f'Department {pk} not found.'}, status=status.HTTP_404_NOT_FOUND)
