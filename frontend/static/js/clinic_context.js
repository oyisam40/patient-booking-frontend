/*
 * Picks which clinic a clinic-admin page is working on.
 *
 * Which clinics can this user work on?
 *   1. GET /api/clinics/my-memberships/ -> { count, memberships: [{ clinic,
 *      clinic_name, role, is_active, ... }] }. Clinics where the user is an
 *      active ADMIN are used.
 *   2. No admin membership: only a platform admin (userRole ADMIN) may go on,
 *      and gets every active clinic from GET /api/clinics/. Anyone else is
 *      told they have no access (onError(403)).
 *
 * Which one is selected first: ?clinic=<id> in the URL, then the last clinic
 * chosen on any clinic page (sessionStorage), then the first in the list.
 * This is UX only. The backend decides what the user may see or change.
 *
 * ClinicContext.init({
 *   selectId:   id of a <select> to fill with clinics (hidden if only one),
 *   onSelect:   function (clinicId, clinic) called on load and on every change,
 *   canChange:  optional function () -> boolean; return false to block a switch
 *               (for example while a form has unsaved changes),
 *   onError:    function (reason) where reason is an HTTP status number,
 *               0 for a network error, or 'none' if there are no clinics.
 * });
 */
(function () {
    var STORAGE_KEY = 'adminClinicId';
    var currentId = null;

    function readStored() {
        try { return sessionStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }

    function store(id) {
        try { sessionStorage.setItem(STORAGE_KEY, String(id)); } catch (e) { /* ignore */ }
    }

    function findClinic(clinics, id) {
        if (id === null || id === undefined || id === '') return null;
        for (var i = 0; i < clinics.length; i++) {
            if (String(clinics[i].id) === String(id)) return clinics[i];
        }
        return null;
    }

    function authHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('accessToken')
        };
    }

    function isPlatformAdmin() {
        try { return (localStorage.getItem('userRole') || '').toUpperCase() === 'ADMIN'; }
        catch (e) { return false; }
    }

    // Returns { clinics, status }. clinics is null when the request failed.
    async function fetchAdminMemberships() {
        var response = await fetch(API_BASE_URL + '/api/clinics/my-memberships/', {
            method: 'GET',
            headers: authHeaders()
        });
        if (!response.ok) return { clinics: null, status: response.status };

        var data = await response.json();
        var list = data.memberships || data.results || data;
        if (!Array.isArray(list)) list = [];

        var seen = {};
        var clinics = [];
        list.forEach(function (m) {
            if (String(m.role).toUpperCase() !== 'ADMIN' || m.is_active === false) return;
            if (seen[m.clinic]) return;
            seen[m.clinic] = true;
            clinics.push({ id: m.clinic, name: m.clinic_name, is_active: true });
        });
        return { clinics: clinics, status: 200 };
    }

    async function fetchAllClinics() {
        var response = await fetch(API_BASE_URL + '/api/clinics/', {
            method: 'GET',
            headers: authHeaders()
        });
        if (!response.ok) return { clinics: null, status: response.status };

        var data = await response.json();
        var list = data.clinics || data.results || data;
        return { clinics: Array.isArray(list) ? list : [], status: 200 };
    }

    async function init(options) {
        var select = document.getElementById(options.selectId);
        var clinics = [];

        try {
            var mine = await fetchAdminMemberships();

            if (mine.clinics && mine.clinics.length > 0) {
                clinics = mine.clinics;
            } else if (isPlatformAdmin()) {
                // Platform admins are not clinic members: they see every clinic.
                var all = await fetchAllClinics();
                if (!all.clinics) {
                    options.onError(all.status);
                    return;
                }
                clinics = all.clinics;
            } else if (!mine.clinics) {
                options.onError(mine.status);
                return;
            } else {
                options.onError(403); // logged in, but not a clinic admin
                return;
            }
        } catch (error) {
            console.error(error);
            options.onError(0);
            return;
        }

        if (!Array.isArray(clinics)) clinics = [];
        clinics = clinics.filter(function (c) { return c.is_active !== false; });

        if (clinics.length === 0) {
            options.onError('none');
            return;
        }

        var urlId = new URLSearchParams(window.location.search).get('clinic');
        var chosen = findClinic(clinics, urlId) || findClinic(clinics, readStored()) || clinics[0];

        if (select) {
            select.innerHTML = clinics.map(function (c) {
                var name = String(c.name == null ? '' : c.name)
                    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                return '<option value="' + String(c.id).replace(/"/g, '') + '">' + name + '</option>';
            }).join('');
            select.value = String(chosen.id);
            select.style.display = clinics.length > 1 ? '' : 'none';

            select.addEventListener('change', function () {
                if (options.canChange && !options.canChange()) {
                    select.value = String(currentId);
                    return;
                }
                var next = findClinic(clinics, select.value);
                if (!next) return;
                currentId = next.id;
                store(next.id);
                options.onSelect(next.id, next);
            });
        }

        currentId = chosen.id;
        store(chosen.id);
        options.onSelect(chosen.id, chosen);
    }

    window.ClinicContext = { init: init };
})();