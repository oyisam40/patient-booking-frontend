/*
 * DOCONNECT clinic document reminder (UX only; the backend decides what is allowed).
 * Add inside <head> of a clinic page, after config.js:
 *   <script src="{% static 'js/clinic_doc_reminder.js' %}"></script>
 * Shows a popup listing rejected and missing clinic documents, with Upload / Replace buttons.
 * "Remind me later" closes it and it returns after 30 seconds while documents are outstanding.
 */
(function () {
    var SNOOZE_MS = 30000;
    var MAX_MB = 5;
    var ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png'];
    var SNOOZE_KEY = 'docReminderSnoozeUntil';
    var TITLES = {
        CLINIC_REGISTRATION: 'Proof of business registration',
        PROOF_OF_ADDRESS: 'Proof of clinic operating address',
        APPLICANT_ID: 'ID of the person applying',
        PROOF_DOCUMENT: 'Proof of bank account'
    };

    var timer = null;
    var busy = false;
    var overlay = null;
    var notice = '';
    var app = null;

    function token() { try { return localStorage.getItem('accessToken'); } catch (e) { return null; } }
    function role() { try { return (localStorage.getItem('userRole') || '').toUpperCase(); } catch (e) { return ''; } }
    function authHeaders() { return { 'Authorization': 'Bearer ' + token() }; }
    function apiBase() { return (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ''; }
    function abs(url) {
        if (!url) return '';
        if (/^https?:/i.test(url)) return url;
        return apiBase() + (url.charAt(0) === '/' ? url : '/' + url);
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function title(type) { return TITLES[String(type || '').toUpperCase()] || String(type || 'Document').replace(/_/g, ' '); }

    function pickApplication(data) {
        if (!data) return null;
        var list = Array.isArray(data) ? data
            : (data.applications || data.results || (data.application ? [data.application] : (data.id ? [data] : [])));
        if (!Array.isArray(list) || !list.length) return null;
        list = list.slice().sort(function (a, b) { return Number(b.id) - Number(a.id); });
        return list[0];
    }

    function outstanding(a) {
        var items = [];
        var docs = a.documents || a.supporting_documents || [];
        docs.forEach(function (d) {
            if (String(d.review_status || '').toUpperCase() === 'REJECTED') {
                items.push({ kind: 'replace', type: d.document_type, doc: d });
            }
        });
        (a.missing_document_types || []).forEach(function (t) {
            var type = (t && typeof t === 'object') ? (t.document_type || t.type || t.value) : t;
            if (type) items.push({ kind: 'upload', type: type });
        });
        return items;
    }

    async function load() {
        try {
            var response = await fetch(apiBase() + '/api/clinics/applications/my/', { headers: authHeaders() });
            if (!response.ok) return null;
            var a = pickApplication(await response.json().catch(function () { return null; }));
            if (!a) return null;
            var status = String(a.status || '').toUpperCase();
            if (status !== 'PENDING' && status !== 'APPROVED') return null;
            return a;
        } catch (e) { return null; }
    }

    function addStyles() {
        if (document.getElementById('dcDocReminderCss')) return;
        var css = document.createElement('style');
        css.id = 'dcDocReminderCss';
        css.textContent =
            '.dcdr-back{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px;}' +
            '.dcdr-box{background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;padding:22px 22px 18px;box-shadow:0 1rem 3rem rgba(0,0,0,.3);font-family:inherit;}' +
            '.dcdr-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;}' +
            '.dcdr-title{font-size:20px;font-weight:700;color:#1B9AAA;margin:0;}' +
            '.dcdr-x{background:none;border:none;font-size:24px;line-height:1;color:#777;cursor:pointer;padding:0 4px;}' +
            '.dcdr-sub{color:#666;font-size:14px;margin:6px 0 14px;}' +
            '.dcdr-row{border:1px solid #e3e8ea;border-radius:10px;padding:12px 14px;margin-bottom:10px;}' +
            '.dcdr-name{font-weight:600;display:flex;justify-content:space-between;gap:8px;align-items:center;}' +
            '.dcdr-tag{font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap;}' +
            '.dcdr-tag.no{background:#f8d7da;color:#721c24;}.dcdr-tag.miss{background:#fff3cd;color:#856404;}' +
            '.dcdr-reason{background:#fdf0f1;color:#721c24;border-radius:8px;padding:8px 10px;font-size:13px;margin-top:8px;}' +
            '.dcdr-row input[type=file]{width:100%;margin-top:10px;font-size:14px;}' +
            '.dcdr-err{color:#b02a37;font-size:13px;margin-top:4px;display:none;}' +
            '.dcdr-btn{background:#1B9AAA;border:1px solid #1B9AAA;color:#fff;border-radius:8px;padding:6px 14px;font-size:14px;cursor:pointer;margin-top:8px;}' +
            '.dcdr-btn:disabled{opacity:.6;cursor:default;}' +
            '.dcdr-view{color:#1B9AAA;font-size:13px;text-decoration:none;display:inline-block;margin-top:4px;}' +
            '.dcdr-ok{background:#d4edda;color:#155724;border-radius:8px;padding:8px 12px;font-size:14px;margin-bottom:12px;}' +
            '.dcdr-foot{display:flex;justify-content:space-between;align-items:center;margin-top:14px;gap:10px;flex-wrap:wrap;}' +
            '.dcdr-later{background:#fff;border:1px solid #c9d3d6;color:#555;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:14px;}' +
            '.dcdr-link{color:#1B9AAA;font-size:14px;}';
        document.head.appendChild(css);
    }

    function row(it) {
        var d = it.doc;
        var html = '<div class="dcdr-row" data-kind="' + it.kind + '" data-type="' + esc(it.type) + '"' +
            (d ? ' data-doc="' + esc(d.id) + '" data-url="' + esc(d.replace_url || '') + '"' : '') + '>' +
            '<div class="dcdr-name"><span>' + esc(title(it.type)) + '</span>' +
            (it.kind === 'replace' ? '<span class="dcdr-tag no">Needs replacing</span>' : '<span class="dcdr-tag miss">Not uploaded</span>') + '</div>';
        if (d && d.rejection_reason) html += '<div class="dcdr-reason"><strong>Reason:</strong> ' + esc(d.rejection_reason) + '</div>';
        if (d && d.file_url) html += '<a href="#" class="dcdr-view" data-url="' + esc(d.file_url) + '">View uploaded file</a>';
        html += '<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">' +
            '<div class="dcdr-err"></div>' +
            '<button type="button" class="dcdr-btn" data-act="' + it.kind + '">' + (it.kind === 'replace' ? 'Upload replacement' : 'Upload document') + '</button></div>';
        return html;
    }

    function render(items) {
        addStyles();
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'dcdr-back';
            overlay.addEventListener('click', onClick);
            document.body.appendChild(overlay);
        }
        overlay.innerHTML =
            '<div class="dcdr-box" role="dialog" aria-modal="true" aria-label="Documents need your attention">' +
            '<div class="dcdr-head"><h2 class="dcdr-title">Documents need your attention</h2>' +
            '<button type="button" class="dcdr-x" data-act="later" aria-label="Close">&times;</button></div>' +
            '<p class="dcdr-sub">The DOCONNECT team needs ' + (items.length === 1 ? 'this document' : 'these documents') +
            ' to keep your clinic record complete.</p>' +
            (notice ? '<div class="dcdr-ok">' + esc(notice) + '</div>' : '') +
            items.map(row).join('') +
            '<div class="dcdr-foot"><a class="dcdr-link" href="/clinic-documents/">Open My Application</a>' +
            '<button type="button" class="dcdr-later" data-act="later">Remind me later</button></div></div>';
        notice = '';
    }

    function close() {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        overlay = null;
    }

    function snooze() {
        close();
        try { sessionStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch (e) { /* ignore */ }
        schedule(SNOOZE_MS);
    }

    function schedule(ms) {
        clearTimeout(timer);
        timer = setTimeout(check, ms);
    }

    async function check() {
        if (busy) { schedule(SNOOZE_MS); return; }
        app = await load();
        var items = app ? outstanding(app) : [];
        if (!items.length) { close(); return; }
        render(items);
    }

    function problemWith(file) {
        if (!file) return 'Please choose a file.';
        var ext = (file.name.split('.').pop() || '').toLowerCase();
        if (ALLOWED_EXT.indexOf(ext) === -1) return 'Use a PDF, JPG or PNG file.';
        if (file.size > MAX_MB * 1024 * 1024) return 'The file is larger than ' + MAX_MB + ' MB.';
        return '';
    }

    function messageFrom(data) {
        var out = [];
        (function walk(v) {
            if (v == null) return;
            if (typeof v === 'string') { out.push(v); return; }
            if (Array.isArray(v)) { v.forEach(walk); return; }
            if (typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k]); });
        })(data);
        return out.join(' ');
    }

    async function openFile(url, win) {
        try {
            var response = await fetch(abs(url), { headers: authHeaders() });
            if (!response.ok) throw new Error('status ' + response.status);
            var blob = await response.blob();
            win.location = URL.createObjectURL(blob);
        } catch (e) {
            win.close();
            alert('The file could not be opened. Please try again.');
        }
    }

    async function send(rowEl, btn) {
        var input = rowEl.querySelector('input[type=file]');
        var err = rowEl.querySelector('.dcdr-err');
        err.style.display = 'none';
        var file = input.files && input.files[0];
        var problem = problemWith(file);
        if (problem) { err.textContent = problem; err.style.display = 'block'; return; }

        var kind = btn.getAttribute('data-act');
        var form = new FormData();
        var url;
        if (kind === 'replace') {
            form.append('file', file);
            url = abs(rowEl.getAttribute('data-url')) || (apiBase() + '/api/clinics/applications/documents/' + encodeURIComponent(rowEl.getAttribute('data-doc')) + '/replace/');
        } else {
            form.append('document_type', rowEl.getAttribute('data-type'));
            form.append('file', file);
            url = abs(app && app.missing_document_upload_url) || (apiBase() + '/api/clinics/applications/' + encodeURIComponent(app && app.id) + '/documents/upload-missing/');
        }

        busy = true;
        btn.disabled = true;
        var label = btn.textContent;
        btn.textContent = 'Uploading...';
        try {
            var response = await fetch(url, { method: 'POST', headers: authHeaders(), body: form });
            var data = await response.json().catch(function () { return null; });
            busy = false;
            if (!response.ok) {
                err.textContent = messageFrom(data) || 'The upload failed. Please try again.';
                err.style.display = 'block';
                btn.disabled = false;
                btn.textContent = label;
                return;
            }
            notice = (data && data.message) || 'Uploaded. The document is awaiting review.';
            await check();
        } catch (e) {
            busy = false;
            err.textContent = 'Network error: could not reach the server.';
            err.style.display = 'block';
            btn.disabled = false;
            btn.textContent = label;
        }
    }

    function onClick(e) {
        var view = e.target.closest('.dcdr-view');
        if (view) {
            e.preventDefault();
            var win = window.open('', '_blank');
            if (win) openFile(view.getAttribute('data-url'), win);
            return;
        }
        var btn = e.target.closest('[data-act]');
        if (!btn || busy) return;
        var act = btn.getAttribute('data-act');
        if (act === 'later') { snooze(); return; }
        if (act === 'replace' || act === 'upload') send(btn.closest('.dcdr-row'), btn);
    }

    function start() {
        if (!token() || role() === 'ADMIN') return;
        var until = 0;
        try { until = Number(sessionStorage.getItem(SNOOZE_KEY)) || 0; } catch (e) { /* ignore */ }
        var wait = until - Date.now();
        if (wait > 0) { schedule(wait); return; }
        check();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
