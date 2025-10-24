from django.urls import path
from django.views.generic.base import RedirectView
from . import views

urlpatterns = [
    # Redirect root to /login/ for dedicated login landing
    path('', RedirectView.as_view(pattern_name='login', permanent=False)),
    path('login/', views.login_page, name='login'),
    path('login/<str:role>/', views.login_role, name='login_role'),
    path('login/demo/<str:role>/', views.login_demo, name='login_demo'),
    path('auth/register/', views.register, name='register'),
    path('auth/logout/', views.logout_view, name='logout_view'),
    path('home/', views.home, name='home'),
    path('customer/', views.customer, name='customer'),
    path('staff/', views.staff, name='staff'),
    path('chef/', views.chef, name='chef'),
    path('rider/', views.rider, name='rider'),
    path('admin/', views.admin_panel, name='admin'),
    # API endpoints
    path('api/orders/', views.api_orders_create, name='api_orders_create'),
    path('api/orders/my', views.api_orders_my, name='api_orders_my'),
    path('api/vouchers/validate/', views.api_vouchers_validate, name='api_vouchers_validate'),
    path('api/rider/jobs/available', views.api_rider_jobs_available, name='api_rider_jobs_available'),
    path('api/rider/jobs/<int:order_id>/accept', views.api_rider_accept, name='api_rider_accept'),
    path('api/rider/jobs/<int:order_id>/picked', views.api_rider_picked, name='api_rider_picked'),
    path('api/rider/jobs/<int:order_id>/complete', views.api_rider_complete, name='api_rider_complete'),
]
