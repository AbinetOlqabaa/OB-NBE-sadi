from django.urls import path
from .views import GrantSpecialAccessView, RevokeSpecialAccessView

urlpatterns = [
    path('users/<str:user_id>/special-access', GrantSpecialAccessView.as_view(), name='grant-special-access'),
    path('users/<str:user_id>/special-access/<str:grant_id>', RevokeSpecialAccessView.as_view(), name='revoke-special-access'),
]
