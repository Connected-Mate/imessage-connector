/* Image trail: moving the pointer lays cards along its path. Decorative only (aria-hidden),
   transform + opacity only, one rAF loop that sleeps when nothing is alive. */
(function () {
  'use strict';
  var box = document.querySelector('[data-trail]');
  if (!box) return;
  var base = box.getAttribute('data-trail');          // e.g. "assets/trail/"
  var MAX = 14, STEP = 40, PLACEHOLDERS = 6;
  var HOLD = 620, OUT = 420;                           // ms before fading, fade duration
  var reduce = /[?&]rm=1\b/.test(location.search) ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var sources = [];
  var treat = 0, TREATS = 4;   // plain · lifted · tilted in 3D · on a glass tile   // [{url, img(loaded HTMLImageElement|null)}]
  var next = 0;

  function webpOK() {
    try { return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0; }
    catch (e) { return false; }
  }
  function pick(entry, webp) {
    var f = typeof entry === 'string' ? entry : entry && typeof entry === 'object' &&
      ((webp && entry.webp) || entry.png || entry.jpg || entry.jpeg || entry.src || entry.file || entry.path || entry.webp);
    if (!f) return null;
    f = String(f).replace(/^\.?\//, '');
    // "assets/trail/x.webp" is relative to the site root; a bare "x.webp" to the manifest folder
    return f.indexOf('/') > -1 ? base.replace(/assets\/trail\/$/, '') + f : base + f;
  }
  function preload(s) {
    if (s.img || s.loading) return;
    s.loading = true;
    var im = new Image();
    im.decoding = 'async';
    im.onload = function () { s.img = im; };
    im.onerror = function () { s.failed = true; };
    im.src = s.url;
  }
  function loadManifest(done) {
    if (!window.fetch) return done();
    fetch(base + 'manifest.json', { cache: 'force-cache' }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (m) {
      var list = Array.isArray(m) ? m : m && (m.images || m.items || m.files || m.cards) || [];
      var webp = webpOK();
      list.forEach(function (e) { var u = pick(e, webp); if (u) sources.push({ url: u, img: null }); });
      sources.slice(0, 6).forEach(preload);
      var rest = function () { sources.slice(6).forEach(preload); };
      if (window.requestIdleCallback) requestIdleCallback(rest, { timeout: 2500 }); else setTimeout(rest, 1200);
      done();
    }).catch(function () { done(); });
  }

  // Card content: next image in order that is ready; otherwise a placeholder gradient.
  function fill(el) {
    el.className = 'card';
    el.textContent = '';
    if (sources.length) {
      for (var n = 0; n < sources.length; n++) {
        var s = sources[(next + n) % sources.length];
        if (s.img) {
          next = (next + n + 1) % sources.length;
          var im = s.img.cloneNode();
          im.alt = '';
          el.appendChild(im);
          el.classList.add('card--icon', 't' + (treat++ % TREATS));
          return;
        }
        preload(s);
      }
    }
    el.classList.add('p' + (next++ % PLACEHOLDERS));
  }

  // ---- reduced motion: a still, scattered arrangement around the edges --------------------
  // [x%, y%, rotation°] — chosen to stay clear of the headlines, the pill and the sub line.
  var SPOTS = [[8, 32, -6], [5, 62, 4], [19, 84, -3], [25, 22, 4], [62, 24, -3], [88, 26, 5], [94, 52, -4], [84, 63, 3]];
  function still() {
    box.classList.add('is-static');
    box.textContent = '';
    // stacked phone layout: no free edges to decorate, so stay quiet
    if (window.matchMedia && window.matchMedia('(max-width: 820px), (max-height: 600px)').matches) return;
    SPOTS.forEach(function (p) {
      var el = document.createElement('div');
      fill(el);
      el.style.left = p[0] + '%';
      el.style.top = p[1] + '%';
      el.style.transform = 'rotate(' + p[2] + 'deg) scale(' + (0.9 + (p[0] % 5) * 0.08).toFixed(2) + ')';
      box.appendChild(el);
    });
  }

  if (reduce) {
    loadManifest(function () {
      // give the first images a moment so the still frame shows real pictures when possible
      setTimeout(still, sources.length ? 400 : 0);
    });
    return;
  }
  loadManifest(function () {});

  // ---- live trail ---------------------------------------------------------------------------
  var pool = [], alive = [], raf = 0, lastX = null, lastY = null, acc = 0, z = 1;
  for (var i = 0; i < MAX; i++) {
    var el = document.createElement('div');
    el.className = 'card';
    box.appendChild(el);
    pool.push({ el: el, on: false });
  }
  function spawn(x, y) {
    var c = null;
    for (var i = 0; i < pool.length; i++) if (!pool[i].on) { c = pool[i]; break; }
    if (!c) c = alive[0];                        // all busy: recycle the oldest
    if (alive.indexOf(c) > -1) alive.splice(alive.indexOf(c), 1);
    fill(c.el);
    c.on = true; c.x = x; c.y = y; c.t0 = performance.now();
    c.rot = (Math.random() * 10 - 5);
    c.s = 0.6; c.v = 0; c.size = 0.78 + Math.random() * 0.5;                            // spring state for scale
    c.el.style.zIndex = String(z++);
    alive.push(c);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  var last = 0;
  function tick(now) {
    var dt = Math.min(0.032, (now - last) / 1000); last = now;
    for (var i = alive.length - 1; i >= 0; i--) {
      var c = alive[i], age = now - c.t0;
      // under-damped spring toward 1 (a whisper of overshoot), then a quick ease-out exit
      var target = 1, k = 420, d = 24;
      c.v += (k * (target - c.s) - d * c.v) * dt;
      c.s += c.v * dt;
      var op = Math.min(1, age / 90), sc = c.s * c.size;
      if (age > HOLD) {
        var p = Math.min(1, (age - HOLD) / OUT), e = 1 - Math.pow(1 - p, 3);
        op = 1 - e; sc = c.s * c.size * (1 - 0.18 * e);
        if (p >= 1) { c.on = false; c.el.style.opacity = '0'; alive.splice(i, 1); continue; }
      }
      c.el.style.opacity = op.toFixed(3);
      c.el.style.transform = 'translate3d(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px,0) rotate(' + c.rot.toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
    }
    raf = alive.length ? requestAnimationFrame(tick) : 0;
  }
  function move(ev) {
    var x = ev.clientX, y = ev.clientY;
    if (lastX === null) { lastX = x; lastY = y; return; }
    var dx = x - lastX, dy = y - lastY, dist = Math.sqrt(dx * dx + dy * dy);
    lastX = x; lastY = y;
    acc += dist;
    if (acc >= STEP) { acc = 0; spawn(x, y); }
  }
  window.addEventListener('pointermove', move, { passive: true });
  // Touch: a finger only leaves cards while it drags. Nothing appears on a plain tap: iOS takes
  // content appearing under a tap for a hover menu and swallows the click (e.g. "Copy prompt").
  window.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType !== 'mouse') { lastX = ev.clientX; lastY = ev.clientY; acc = 0; }
  }, { passive: true });
  document.addEventListener('pointerleave', function () { lastX = null; }, { passive: true });
  // Don't keep animating in a hidden tab.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; alive.forEach(function (c) { c.on = false; c.el.style.opacity = '0'; }); alive = []; }
  });
})();
