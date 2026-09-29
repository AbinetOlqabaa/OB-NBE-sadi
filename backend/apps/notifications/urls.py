from django.urls import path
from .views import NotificationListView, NotificationMarkReadView, NotificationClearAllView

urlpatterns = [
    path('notifications', NotificationListView.as_view(), name='notification-list'),
    path('notifications/<str:pk>/read', NotificationMarkReadView.as_view(), name='notification-read'),
    path('notifications/clear', NotificationClearAllView.as_view(), name='notification-clear'),
]
