from django.urls import path
from .views import DepartmentListView, DepartmentDetailView

urlpatterns = [
    path('', DepartmentListView.as_view(), name='department-list'),
    path('<str:pk>/', DepartmentDetailView.as_view(), name='department-detail'),
]
