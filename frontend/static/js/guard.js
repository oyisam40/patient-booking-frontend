/*
 * DOCONNECT page guard (UX only; the backend still enforces real access).
 *
 * Usage, inside <head> of a template that has {% load static %}:
 *   <script src="{% static 'js/guard.js' %}" data-allow="ADMIN"></script>
 *   data-allow takes one or more roles, comma separated: PATIENT, DOCTOR, ADMIN.
 *   Leave data-allow off to require login only (shared pages, clinic pages).
 *
 * - No token, or an expired token  -> clear the session, go to login.
 * - Logged in with the wrong role  -> go to that role's own home page.
 */
(function () {
    var LOGIN_URL = '/login/';
    var HOME_BY_ROLE = {
        PATIENT: '/patient-profile/',
        DOCTOR: '/doctor_profile/',
        ADMIN: '/admin-dashboard/'
    };

    var script = document.currentScript;
    var allowAttr = script ? script.getAttribute('data-allow') : null;
    var allowed = allowAttr
        ? allowAttr.split(',').map(function (r) { return r.trim().toUpperCase(); })
        : null;

    function clearSession() {
        try {
            ['accessToken', 'refreshToken', 'userRole'].forEach(function (key) {
                localStorage.removeItem(key);
            });
        } catch (e) { /* storage unavailable: nothing to clear */ }
    }

    function isExpired(token) {
        try {
            var payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            var exp = JSON.parse(atob(payload)).exp;
            return typeof exp === 'number' && exp * 1000 < Date.now();
        } catch (e) {
            return false; // not a readable JWT: let the server decide
        }
    }

    function go(url) {
        // Stop the rest of the page from rendering or calling the API.
        document.documentElement.style.visibility = 'hidden';
        window.location.replace(url);
    }

    var token = null;
    var role = null;
    try {
        token = localStorage.getItem('accessToken');
        role = (localStorage.getItem('userRole') || '').toUpperCase();
    } catch (e) { /* treated as logged out below */ }

    if (!token || isExpired(token)) {
        clearSession();
        go(LOGIN_URL);
        return;
    }

    if (allowed) {
        // No stored role (an older login) also fails here: logging in again fixes it.
        if (!role) {
            clearSession();
            go(LOGIN_URL);
            return;
        }
        if (allowed.indexOf(role) === -1) {
            go(HOME_BY_ROLE[role] || LOGIN_URL);
        }
    }
})();