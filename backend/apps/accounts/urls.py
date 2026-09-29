from django.urls import path
from .views import (
    LoginView,
    RegisterView,
    SendOtpView,
    VerifyOtpView,
    ResetPasswordView,
    BiometricsRegisterView,
    BiometricsVerifyView,
    BiometricsStatusView,
    UserListView,
    UserStatusView,
    UserDetailView,
    SeedDataSummaryView,
    SeedDataResetView,
)

urlpatterns = [
    # Auth Endpoints
    path('auth/login', LoginView.as_view(), name='auth-login'),
    path('auth/register', RegisterView.as_view(), name='auth-register'),
    path('auth/otp/send', SendOtpView.as_view(), name='auth-otp-send'),
    path('auth/otp/verify', VerifyOtpView.as_view(), name='auth-otp-verify'),
    path('auth/reset-password', ResetPasswordView.as_view(), name='auth-reset-password'),
    path('auth/biometrics/register', BiometricsRegisterView.as_view(), name='auth-biometrics-register'),
    path('auth/biometrics/verify', BiometricsVerifyView.as_view(), name='auth-biometrics-verify'),
    path('auth/biometrics/status/<str:email>', BiometricsStatusView.as_view(), name='auth-biometrics-status'),
    path('auth/seed-data', SeedDataSummaryView.as_view(), name='auth-seed-data'),
    path('auth/seed-data/reset', SeedDataResetView.as_view(), name='auth-seed-data-reset'),

    # Users Management Endpoints
    path('users', UserListView.as_view(), name='user-list'),
    path('users/<str:user_id>/status', UserStatusView.as_view(), name='user-status'),
    path('users/<str:user_id>', UserDetailView.as_view(), name='user-detail'),
]
