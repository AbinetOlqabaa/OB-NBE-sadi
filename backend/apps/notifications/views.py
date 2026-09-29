from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Notification
from .serializers import NotificationSerializer

class NotificationListView(APIView):
    def get(self, request):
        user_id = request.query_params.get('userId')
        qs = Notification.objects.all()
        if user_id:
            qs = qs.filter(user_id=user_id)
        serializer = NotificationSerializer(qs[:50], many=True)
        return Response(serializer.data)

class NotificationMarkReadView(APIView):
    def post(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk)
            notif.read = True
            notif.save(update_fields=['read'])
            return Response({'success': True, 'notification': NotificationSerializer(notif).data})
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)

class NotificationClearAllView(APIView):
    def delete(self, request):
        user_id = request.query_params.get('userId')
        if user_id:
            Notification.objects.filter(user_id=user_id).delete()
        else:
            Notification.objects.all().delete()
        return Response({'success': True, 'message': 'Notifications cleared'})
