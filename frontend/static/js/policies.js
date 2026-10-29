/*
 * DOCONNECT registration policies.
 *
 * Add this ONE line to a registration page, after config.js is loaded:
 *   <script src="{% static 'js/policies.js' %}"></script>
 *
 * What it does:
 *  - Loads GET /api/policies/ and shows each policy (title, version, full text)
 *    with its own unchecked "I have read and accept" box, just above the form's
 *    submit button. No policy text is hardcoded.
 *  - Blocks the form from submitting until every policy is accepted, and shows an
 *    error with a Retry button when the policies cannot be loaded.
 *  - Adds  accepted_policies: true  to the registration request, only after all
 *    policies are accepted. It covers POST /api/auth/register/ (patient, doctor)
 *    and POST /api/clinics/applications/ (clinic draft), JSON or FormData.
 */
(function () {
    var POLICIES_PATH = '/api/policies/';
    var GATED = [/\/api\/auth\/register\/?$/, /\/api\/clinics\/applications\/?$/];

    var base = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : '';
    var state = { status: 'loading', policies: [], message: '' };
    var box, form;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function allAccepted() {
        if (state.status !== 'ready' || !state.policies.length) return false;
        var boxes = box.querySelectorAll('input[data-policy]');
        if (boxes.length !== state.policies.length) return false;
        for (var i = 0; i < boxes.length; i++) if (!boxes[i].checked) return false;
        return true;
    }

    function setError(text) {
        var el = box.querySelector('.pol-error');
        if (!el) return;
        el.textContent = text || '';
        el.style.display = text ? 'block' : 'none';
    }

    function draw() {
        var html = '<div class="pol-title">Required policies</div>';
        if (state.status === 'loading') {
            html += '<div class="pol-note">Loading policies...</div>';
        } else if (state.status === 'error') {
            html += '<div class="pol-fail">' + esc(state.message) + '</div>' +
                    '<button type="button" class="pol-retry">Try again</button>';
        } else {
            state.policies.forEach(function (p, i) {
                var label = esc(p.title || p.key) + (p.version ? ' (version ' + esc(p.version) + ')' : '');
                html += '<details class="pol-item">' +
                        '<summary>' + label + '</summary>' +
                        '<div class="pol-text" tabindex="0">' + esc(p.content) + '</div></details>' +
                        '<label class="pol-check"><input type="checkbox" data-policy="' + i + '"> ' +
                        'I have read and accept the ' + label + '.</label>';
            });
        }
        html += '<div class="pol-error" role="alert" style="display:none"></div>';
        box.innerHTML = html;
        var retry = box.querySelector('.pol-retry');
        if (retry) retry.addEventListener('click', load);
        box.querySelectorAll('input[data-policy]').forEach(function (c) {
            c.addEventListener('change', function () { if (allAccepted()) setError(''); });
        });
    }

    async function load() {
        state = { status: 'loading', policies: [], message: '' };
        draw();
        try {
            var r = await fetch(base + POLICIES_PATH, { headers: { 'Accept': 'application/json' } });
            if (!r.ok) throw new Error('bad');
            var data = await r.json();
            var list = Array.isArray(data) ? data : (data && (data.results || data.policies)) || [];
            if (!list.length) throw new Error('empty');
            state = { status: 'ready', policies: list, message: '' };
        } catch (e) {
            state = { status: 'error', policies: [],
                      message: 'The policies could not be loaded, so you cannot register yet. Check your connection and try again.' };
        }
        draw();
    }

    function addStyles() {
        var css = document.createElement('style');
        css.textContent =
            '.pol-box{border:1px solid rgba(0,0,0,.12);border-radius:12px;padding:14px;margin:18px 0;background:#f8fcfc;text-align:left}' +
            '.pol-title{font-weight:700;margin-bottom:8px}' +
            '.pol-note{color:#555;font-size:14px}' +
            '.pol-fail{color:#721c24;background:#f8d7da;border-radius:8px;padding:8px 10px;font-size:14px;margin-bottom:8px}' +
            '.pol-retry{border:1px solid #1B9AAA;background:#fff;color:#1B9AAA;border-radius:8px;padding:6px 14px;font-weight:600;cursor:pointer}' +
            '.pol-item{margin-top:8px}' +
            '.pol-item summary{cursor:pointer;font-weight:600;color:#14727e;font-size:14px}' +
            '.pol-text{white-space:pre-wrap;max-height:200px;overflow:auto;border:1px solid rgba(0,0,0,.1);border-radius:8px;background:#fff;padding:10px;margin-top:6px;font-size:13px;line-height:1.5;color:#333}' +
            '.pol-check{display:flex;gap:8px;align-items:flex-start;font-size:14px;margin:6px 0 0;cursor:pointer}' +
            '.pol-check input{margin-top:3px}' +
            '.pol-error{color:#b02a37;font-size:14px;font-weight:600;margin-top:8px}';
        document.head.appendChild(css);
    }

    function gated(url, method) {
        if (String(method || 'GET').toUpperCase() !== 'POST') return false;
        var path = String(url).split('?')[0];
        return GATED.some(function (re) { return re.test(path); });
    }

    // Adds accepted_policies: true to the registration request.
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = (init && init.method) || (input && input.method) || 'GET';
        if (box && gated(url, method)) {
            if (!allAccepted()) {
                setError('Please read and accept all the policies to continue.');
                return Promise.reject(new TypeError('Policies not accepted'));
            }
            init = Object.assign({}, init);
            if (init.body instanceof FormData) {
                init.body.set('accepted_policies', 'true');
            } else if (typeof init.body === 'string') {
                try { var o = JSON.parse(init.body); o.accepted_policies = true; init.body = JSON.stringify(o); } catch (e) { /* not JSON */ }
            }
        }
        return nativeFetch(input, init);
    };

    function init() {
        form = document.querySelector('form#registerForm') ||
               (document.querySelector('form input[type="password"]') || {}).form ||
               document.querySelector('form');
        if (!form) return;
        var submit = form.querySelector('button[type="submit"], input[type="submit"]');
        addStyles();
        box = document.createElement('div');
        box.className = 'pol-box';
        box.id = 'policyBox';
        if (submit && submit.parentNode) submit.parentNode.insertBefore(box, submit);
        else form.appendChild(box);

        // Stops the form before the page's own submit handler runs.
        document.addEventListener('submit', function (e) {
            if (e.target !== form) return;
            if (!allAccepted()) {
                e.preventDefault();
                e.stopImmediatePropagation();
                setError(state.status === 'ready'
                    ? 'Please read and accept all the policies to continue.'
                    : 'The policies must load before you can register.');
                box.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, true);
        load();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();