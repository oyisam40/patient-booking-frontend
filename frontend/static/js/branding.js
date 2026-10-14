/*
 * DOCONNECT branding (UX only).
 *
 * Usage, inside <head> of a template that has {% load static %}:
 *   <script src="{% static 'js/branding.js' %}"
 *           data-logo="{% static 'images/Doconnect.jpg' %}"
 *           data-bg="{% static 'images/alterfines-medicine-2361046_1920.jpg' %}"></script>
 *
 * - Puts the logo in front of the "DOCONNECT" text in the top bar.
 * - Puts the landing-page background (teal overlay + photo) behind the page.
 * - Adds a round profile picture on the right of the top bar. It shows the
 *   logo until the user chooses a photo; clicking it opens a small menu to
 *   change or remove the photo.
 *
 * WHERE THE PHOTO IS KEPT: there is no profile-picture endpoint on the backend
 * yet, so the photo is resized in the browser and saved in localStorage for
 * this user on this browser only. When the backend has an endpoint, set
 * AVATAR_ENDPOINT below (it receives a multipart PATCH with the field
 * AVATAR_FIELD) and read the saved picture URL from the user's profile.
 */
(function () {
    var AVATAR_ENDPOINT = null;      // e.g. '/api/accounts/profile-picture/'
    var AVATAR_FIELD = 'profile_picture';
    var MAX_INPUT_MB = 5;
    var SIZE = 256;                  // saved picture is SIZE x SIZE pixels

    var script = document.currentScript;
    var logoUrl = script ? script.getAttribute('data-logo') : '';
    var bgUrl = script ? script.getAttribute('data-bg') : '';

    // ---- background ----------------------------------------------------
    if (bgUrl) {
        var css = document.createElement('style');
        css.textContent =
            'body{background:linear-gradient(135deg,rgba(27,154,170,.82),rgba(79,209,197,.82)),' +
            'url("' + bgUrl + '") center/cover no-repeat fixed !important;}' +
            '.dc-avatar-wrap{position:relative;margin-left:auto;}' +
            '.dc-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;cursor:pointer;' +
            'border:2px solid #1B9AAA;background:#fff;padding:0;display:block;}' +
            '.dc-menu{display:none;position:absolute;right:0;top:46px;min-width:170px;background:#fff;' +
            'border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:6px;z-index:2000;}' +
            '.dc-menu.open{display:block;}' +
            '.dc-menu button{display:block;width:100%;text-align:left;background:none;border:none;' +
            'padding:9px 12px;border-radius:8px;font-size:14px;color:#1a1a1a;cursor:pointer;}' +
            '.dc-menu button:hover{background:#eef8fa;color:#1B9AAA;}' +
            '.dc-menu .dc-msg{padding:6px 12px;font-size:12px;color:#b02a37;}' +
            '.dc-logo{height:32px;width:auto;margin-right:8px;vertical-align:middle;border-radius:6px;}';
        document.head.appendChild(css);
    }

    function storage(fn) { try { return fn(localStorage); } catch (e) { return null; } }

    // The user id comes from the JWT so each person on this browser gets their own picture.
    function userKey() {
        var token = storage(function (s) { return s.getItem('accessToken'); });
        try {
            var p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return 'doconnect_avatar_' + (p.user_id || p.sub || 'user');
        } catch (e) { return 'doconnect_avatar_user'; }
    }

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    ready(function () {
        var bar = document.querySelector('.app-topbar');
        if (!bar) return;

        // ---- logo next to the brand name ----
        var brand = bar.querySelector('.app-logo');
        if (brand && logoUrl && !brand.querySelector('.dc-logo')) {
            var img = document.createElement('img');
            img.className = 'dc-logo';
            img.src = logoUrl;
            img.alt = '';
            brand.insertBefore(img, brand.firstChild);
        }

        // ---- profile picture (only when someone is signed in) ----
        if (!storage(function (s) { return s.getItem('accessToken'); })) return;
        var key = userKey();

        var wrap = document.createElement('div');
        wrap.className = 'dc-avatar-wrap';
        wrap.innerHTML =
            '<img class="dc-avatar" alt="Your profile picture" title="Profile picture">' +
            '<div class="dc-menu" role="menu">' +
            '<button type="button" data-act="change">Change photo</button>' +
            '<button type="button" data-act="remove">Remove photo</button>' +
            '<div class="dc-msg" style="display:none;"></div></div>' +
            '<input type="file" accept="image/jpeg,image/png,image/webp" style="display:none;">';
        bar.appendChild(wrap);

        var avatar = wrap.querySelector('.dc-avatar');
        var menu = wrap.querySelector('.dc-menu');
        var msg = wrap.querySelector('.dc-msg');
        var input = wrap.querySelector('input[type=file]');

        function current() { return storage(function (s) { return s.getItem(key); }); }
        function show() {
            var saved = current();
            avatar.src = saved || logoUrl || '';
            wrap.querySelector('[data-act=remove]').style.display = saved ? 'block' : 'none';
        }
        function say(text) { msg.textContent = text || ''; msg.style.display = text ? 'block' : 'none'; }

        avatar.addEventListener('click', function (e) { e.stopPropagation(); say(''); menu.classList.toggle('open'); });
        document.addEventListener('click', function () { menu.classList.remove('open'); });

        wrap.addEventListener('click', function (e) {
            var act = e.target.getAttribute && e.target.getAttribute('data-act');
            if (act === 'change') input.click();
            if (act === 'remove') { storage(function (s) { s.removeItem(key); }); show(); menu.classList.remove('open'); }
        });

        input.addEventListener('change', function () {
            var file = input.files && input.files[0];
            input.value = '';
            if (!file) return;
            if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { say('Choose a JPG, PNG or WebP image.'); return; }
            if (file.size > MAX_INPUT_MB * 1024 * 1024) { say('That image is larger than ' + MAX_INPUT_MB + ' MB.'); return; }
            var reader = new FileReader();
            reader.onerror = function () { say('Could not read that file.'); };
            reader.onload = function () {
                var pic = new Image();
                pic.onerror = function () { say('That file is not a valid image.'); };
                pic.onload = function () {
                    // Centre-crop to a square, then shrink.
                    var side = Math.min(pic.width, pic.height);
                    var canvas = document.createElement('canvas');
                    canvas.width = canvas.height = SIZE;
                    canvas.getContext('2d').drawImage(pic, (pic.width - side) / 2, (pic.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
                    var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    var saved = storage(function (s) { s.setItem(key, dataUrl); return true; });
                    if (!saved) { say('Your browser could not save the photo.'); return; }
                    show();
                    menu.classList.remove('open');
                    upload(canvas);
                };
                pic.src = reader.result;
            };
            reader.readAsDataURL(file);
        });

        // Optional: send the picture to the backend once an endpoint exists.
        function upload(canvas) {
            if (!AVATAR_ENDPOINT || typeof API_BASE_URL === 'undefined') return;
            canvas.toBlob(function (blob) {
                if (!blob) return;
                var form = new FormData();
                form.append(AVATAR_FIELD, blob, 'profile.jpg');
                fetch(API_BASE_URL + AVATAR_ENDPOINT, {
                    method: 'PATCH',
                    headers: { 'Authorization': 'Bearer ' + storage(function (s) { return s.getItem('accessToken'); }) },
                    body: form
                }).catch(function () { /* the local copy is still saved */ });
            }, 'image/jpeg', 0.85);
        }

        show();
    });
})();