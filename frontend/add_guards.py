"""Adds the guard.js script tag to the DOCONNECT templates.

Run from the repo root:  python3 add_guards.py
Safe to run twice: pages that already have the guard are skipped.
Adds a .bak copy of every page it changes.
"""
import glob, os, shutil

T = 'frontend/templates/'
ROLES = {
    'ADMIN': ['admin_dashboard', 'admin_doctor_management', 'admin_doctor_detail',
              'admin_patient_management', 'admin_patient_detail',
              'admin_document_review', 'admin_clinic_management'],
    'DOCTOR': ['doctor_profile', 'doctor_profile_edit', 'doctor_availability',
               'doctor_appointments', 'doctor_chat', 'doctor_documents'],
    'PATIENT': ['patient_profile', 'patient_profile_edit', 'patient_appointments',
                'browse_doctors', 'doctor_detail', 'symptom_checker', 'patient_chat'],
}
LOGIN_ONLY = ['notifications'] + sorted(
    os.path.basename(p)[:-5] for p in glob.glob(T + 'clinic_*.html'))

ANCHOR = "<script src=\"{% static 'js/config.js' %}\"></script>"

def add(name, allow):
    path = T + name + '.html'
    if not os.path.exists(path):
        print('missing  ', path); return
    s = open(path, encoding='utf-8').read()
    if 'js/guard.js' in s:
        print('already  ', name); return
    if ANCHOR not in s:
        print('NO ANCHOR', name, '(add the tag by hand)'); return
    attr = f' data-allow="{allow}"' if allow else ''
    tag = f"<script src=\"{{% static 'js/guard.js' %}}\"{attr}></script>\n    "
    shutil.copy(path, path + '.bak')
    open(path, 'w', encoding='utf-8').write(s.replace(ANCHOR, tag + ANCHOR, 1))
    print('guarded  ', name, allow or '(login only)')

for role, pages in ROLES.items():
    for p in pages: add(p, role)
for p in LOGIN_ONLY: add(p, None)