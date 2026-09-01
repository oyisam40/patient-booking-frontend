from django.urls import path
from . import views

urlpatterns = [
    path('', views.landing, name='landing'),
    path('login/', views.home, name='home'),
    path('register/', views.register, name='register'),
    path('doctor-register/', views.doctor_register, name='doctor_register'),

    path('verify-otp/', views.verify_otp, name='verify_otp'),

    path('under_construction/', views.under_construction, name='under_construction'),

    path('user_verify/', views.user_verify, name='user_verify'),

    path('doctor_profile/',views.doctor_profile, name='doctor_profile'),

    path('doctor-profile/edit/', views.doctor_profile_edit, name='doctor_profile_edit'),

    path('doctor-availability/', views.doctor_availability, name='doctor_availability'),

    path('doctor-appointments/', views.doctor_appointments, name='doctor_appointments'),

    path('admin-dashboard/', views.admin_dashboard, name='admin_dashboard'),

    path('admin-doctors/', views.admin_doctor_management, name='admin_doctor_management'),

    path('patient-profile/', views.patient_profile, name='patient_profile'),

    path('patient-profile/edit/', views.patient_profile_edit, name='patient_profile_edit'),

    path('browse-doctors/', views.browse_doctors, name='browse_doctors'),

    path('doctors/<int:doctor_id>/', views.doctor_detail, name='doctor_detail'),

    path('patient-appointments/', views.patient_appointments, name='patient_appointments'),

    path('admin-patients/', views.admin_patient_management, name='admin_patient_management'),

    path('admin-patients/<int:patient_id>/', views.admin_patient_detail, name='admin_patient_detail'),

    path('admin-doctors/<int:doctor_id>/', views.admin_doctor_detail, name='admin_doctor_detail'),

    path('notifications/', views.notifications, name='notifications'),
]
