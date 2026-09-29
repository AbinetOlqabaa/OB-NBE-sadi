from django.urls import path
from .views import (
    SubmissionListView,
    SubmissionDetailView,
    SubmissionValidateView,
    SubmissionSubmitView,
    SubmissionReviewView,
    SubmissionDeliverView,
    SubmissionBatchSyncView,
    SubmissionExportXlsxView,
)

urlpatterns = [
    path('regulatory/submissions', SubmissionListView.as_view(), name='submission-list'),
    path('regulatory/submissions/batch-sync', SubmissionBatchSyncView.as_view(), name='submission-batch-sync'),
    path('regulatory/submissions/<str:pk>', SubmissionDetailView.as_view(), name='submission-detail'),
    path('regulatory/submissions/<str:pk>/validate', SubmissionValidateView.as_view(), name='submission-validate'),
    path('regulatory/submissions/<str:pk>/submit', SubmissionSubmitView.as_view(), name='submission-submit'),
    path('regulatory/submissions/<str:pk>/review', SubmissionReviewView.as_view(), name='submission-review'),
    path('regulatory/submissions/<str:pk>/deliver', SubmissionDeliverView.as_view(), name='submission-deliver'),
    path('regulatory/submissions/<str:pk>/export/xlsx', SubmissionExportXlsxView.as_view(), name='submission-export-xlsx'),
]
