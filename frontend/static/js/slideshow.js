/*
 * slideshow.js - crossfading photo background with the DOCONNECT teal tint on top.
 *
 * Usage (in <head>, no other markup needed):
 *   <script src="{% static 'js/slideshow.js' %}"
 *           data-slides="{% static 'images/a.jpg' %},{% static 'images/hero-2.jpg' %}"></script>
 *
 * Images that do not exist are skipped. Falls back to the teal gradient.
 * Optional: data-interval="6000" (milliseconds).
 */
(function () {
    var script = document.currentScript;
    var list = ((script && script.getAttribute('data-slides')) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var interval = parseInt((script && script.getAttribute('data-interval')) || '6000', 10);

    var css = document.createElement('style');
    css.textContent =
        '.dc-slides,.dc-tint{position:fixed;inset:0;}' +
        '.dc-slides{z-index:-2;background:linear-gradient(135deg,#1B9AAA,#4FD1C5);}' +
        '.dc-slides .dc-slide{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.6s ease;}' +
        '.dc-slides .dc-slide.on{opacity:1;}' +
        '.dc-tint{z-index:-1;background:linear-gradient(135deg,rgba(27,154,170,.82),rgba(79,209,197,.82));}' +
        '@media (prefers-reduced-motion:reduce){.dc-slides .dc-slide{transition:none;}}';
    document.head.appendChild(css);

    function start() {
        var box = document.createElement('div'); box.className = 'dc-slides'; box.setAttribute('aria-hidden', 'true');
        var tint = document.createElement('div'); tint.className = 'dc-tint'; tint.setAttribute('aria-hidden', 'true');
        document.body.insertBefore(tint, document.body.firstChild);
        document.body.insertBefore(box, document.body.firstChild);

        var check = function (src) {
            return new Promise(function (res) { var i = new Image(); i.onload = function () { res(src); }; i.onerror = function () { res(null); }; i.src = src; });
        };
        Promise.all(list.map(check)).then(function (found) {
            var ok = found.filter(Boolean);
            if (!ok.length) return;
            var els = ok.map(function (src) {
                var d = document.createElement('div'); d.className = 'dc-slide';
                d.style.backgroundImage = 'url("' + src + '")'; box.appendChild(d); return d;
            });
            els[0].classList.add('on');
            if (els.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            var i = 0;
            setInterval(function () {
                if (document.hidden) return;
                els[i].classList.remove('on'); i = (i + 1) % els.length; els[i].classList.add('on');
            }, interval);
        });
    }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();