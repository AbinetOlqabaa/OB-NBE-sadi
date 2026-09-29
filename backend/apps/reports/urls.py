from django.urls import path
from .views import RegulatoryTemplateListView, RegulatoryTemplateDetailView

urlpatterns = [
    path('regulatory/templates', RegulatoryTemplateListView.as_view(), name='regulatory-template-list'),
    path('regulatory/templates/<str:key>', RegulatoryTemplateDetailView.as_view(), name='regulatory-template-detail'),
]
