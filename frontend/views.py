from django.shortcuts import render

def landing(request):
    return render(request, 'landing.html')


def home(request):
    return render(request, 'home.html')


def register(request):
    return render(request, 'register.html')


def doctor_register(request):
    return render(request, 'doctor_register.html')

def verify_otp(request):
    return render(request, 'verify_otp.html')

def under_construction(request):
    return render(request, 'under_construction.html')

def user_verify(request):
    return render(request, 'user_verify.html')

def doctor_profile(request):
    return render(request, 'doctor_profile.html')

def doctor_profile_edit(request):
    return render(request, 'doctor_profile_edit.html')

def admin_doctor_detail(request, doctor_id):
    return render(request, 'admin_doctor_detail.html')

def doctor_availability(request):
    return render(request, 'doctor_availability.html')

def doctor_appointments(request):
    return render(request, 'doctor_appointments.html')

def admin_dashboard(request):
    return render(request, 'admin_dashboard.html')

def admin_doctor_management(request):
    return render(request, 'admin_doctor_management.html')

def patient_profile(request):
    return render(request, 'patient_profile.html')

def patient_profile_edit(request):
    return render(request, 'patient_profile_edit.html')

def browse_doctors(request):
    return render(request, 'browse_doctors.html')

def doctor_detail(request, doctor_id):
    return render(request,'doctor_detail.html')

def patient_appointments(request):
    return render(request, 'patient_appointments.html')

def admin_patient_management(request):
    return render(request, 'admin_patient_management.html')

def admin_patient_detail(request, patient_id):
    return render(request, 'admin_patient_detail.html')

def notifications(request):
    return render(request, 'notifications.html')