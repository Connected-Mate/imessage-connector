/* iMessage Connector — the bottom-of-page moment on more.html.
   When the end of the FAQ comes into view, Messages icons and a few agent tiles rain down and pile up
   along both side margins (gravity, stacking in columns, a small bounce, a slight tilt, then still).
   Contract:
   - The text column is never covered: free margins are measured from the bounding box of the content
     that sits beside the piles. Margins too narrow (phones, small tablets) → one short pile in the
     reserved strip under the text (.pile-floor) instead.
   - ≤ 60 sprites, transform/opacity only, one rAF loop, paused while the piles are off-screen or the
     tab is hidden, stopped once everything has settled.
   - Plays once per visit (sessionStorage, try/catch). Later in the same visit, or with reduced motion
     (system setting or ?rm=1), the piles appear already settled. ?pile=1 forces the animation.
   - window.__icPile = { state, mode, count, frames:[ms], settledAt } for measurement. */
(function () {
  'use strict';
  var layer = document.querySelector('[data-pile]');
  var trigger = document.querySelector('[data-pile-trigger]');
  if (!layer || !trigger || !('IntersectionObserver' in window)) return;

  var q = location.search;
  var reduce = /[?&]rm=1\b/.test(q) || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var force = /[?&]pile=1\b/.test(q);
  var KEY = 'imessage-connector-pile';
  var MAX = 60, G = 2600, BOUNCE = 0.26, STEP = 0.84;   // px/s², restitution, stacking overlap
  var srcs = (layer.getAttribute('data-pile') || '').split(',').filter(Boolean);
  if (!srcs.length) return;
  var stats = window.__icPile = { state: 'idle', mode: '', count: 0, frames: [], settledAt: 0 };

  function seen() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function remember() { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  var sprites = [], cols = [], geo = null, raf = 0, last = 0, visible = true, zone = null, zoneIo = null, t0 = 0;

  // the body's own box: the layer is absolutely positioned, so it never props the page open
  function docHeight() { return document.body.offsetHeight; }

  // ---- geometry: free margins beside the content that sits next to the piles ------------------
  function measure() {
    var vw = document.documentElement.clientWidth, vh = window.innerHeight, H = docHeight(), sy = window.pageYOffset;
    var pileH = Math.min(vh * 0.46, 400);
    var top = H - pileH;
    var L = Infinity, R = -Infinity;
    document.querySelectorAll('main section > *, main .sec__head > *, main .fine > *, main .mh > *').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var t = r.top + sy, b = r.bottom + sy;
      if (b < top - 40 || t > H) return;
      if (r.left < L) L = r.left;
      if (r.right > R) R = r.right;
    });
    if (L === Infinity) { L = vw / 2 - 380; R = vw / 2 + 380; }
    var edge = 10, pad = 18;
    var s = vw >= 1280 ? 58 : 50;
    var leftW = L - pad - edge, rightW = vw - edge - (R + pad);
    var g = { vw: vw, vh: vh, H: H, cols: [] };
    if (Math.min(leftW, rightW) >= s + 6) {
      g.mode = 'side'; g.s = s; g.floor = H - 2; g.max = pileH;
      [[edge, leftW, 1], [R + pad, rightW, -1]].forEach(function (z) {
        var x0 = z[0], w = z[1], n = Math.max(1, Math.min(4, Math.floor(w / (s * 1.02))));
        var span = n * s * 1.02, start = z[2] === 1 ? x0 + (w - span) * 0.15 : x0 + (w - span) * 0.85;
        for (var i = 0; i < n; i++) {
          // outer columns (screen edge) stand taller than inner ones (next to the text)
          var fromEdge = z[2] === 1 ? i : n - 1 - i;
          var h = g.max * (1 - 0.5 * (n > 1 ? fromEdge / (n - 1) : 0)) * rnd(0.75, 1);
          g.cols.push({ x: start + i * s * 1.02 + s * 0.01, cap: Math.max(s, h), lo: x0, hi: x0 + w - s });
        }
      });
    } else {
      g.mode = 'bottom'; s = 40; g.s = s;
      var strip = document.querySelector('.pile-floor');
      // the strip is reserved by CSS below 1220 px; anything else (zoom, odd widths) gets it here
      if (strip && strip.getBoundingClientRect().height < 80) { strip.style.height = '120px'; H = docHeight(); g.H = H; }
      var sh = strip ? strip.getBoundingClientRect().height : 0;
      g.max = Math.max(s, sh - 10);
      var w2 = vw - 2 * (edge + 8), n2 = Math.floor(w2 / (s * 1.04)), x0 = (vw - n2 * s * 1.04) / 2;
      g.floor = H - 4;
      for (var j = 0; j < n2; j++) g.cols.push({ x: x0 + j * s * 1.04, cap: g.max * rnd(0.55, 1), lo: edge, hi: vw - edge - s });
    }
    return g;
  }

  // ---- plan: which sprite rests where (column, height in the stack) --------------------------
  function plan(g) {
    var step = g.s * STEP, out = [];
    g.cols.forEach(function (c) { c.h = 0; c.top = null; });
    for (var k = 0; k < MAX; k++) {
      var open = g.cols.filter(function (c) { return c.h + g.s <= c.cap + 0.5; });
      if (!open.length) break;
      open.sort(function (a, b) { return a.h / a.cap - b.h / b.cap; });
      var c = open[Math.floor(Math.random() * Math.min(3, open.length))];
      // a loose pile, not a grid: each level leans a little left or right, never past the zone
      var lean = (Math.round(c.h / step) % 2 ? 1 : -1) * rnd(0.06, 0.2) * g.s;
      var px = Math.max(c.lo, Math.min(c.hi, c.x + lean));
      var p = { col: c, below: c.top ? c.top.i : -1, i: out.length, restY: g.floor - c.h - g.s, x: px, rf: rnd(-14, 14) };
      c.h += step; c.top = p;
      out.push(p);
    }
    return out;
  }

  function makeSprite(i) {
    var img = document.createElement('img');
    // most are the Messages icon; every few, an agent tile
    var src = (i % 3 === 2 && srcs.length > 1) ? srcs[1 + Math.floor(Math.random() * (srcs.length - 1))] : srcs[0];
    img.src = src; img.alt = ''; img.decoding = 'async'; img.draggable = false;
    if (src !== srcs[0]) img.className = 'is-tile';
    return img;
  }

  function place(sp) {
    sp.el.style.transform = 'translate3d(' + sp.x.toFixed(1) + 'px,' + sp.y.toFixed(1) + 'px,0) rotate(' + sp.r.toFixed(2) + 'deg)';
  }

  function build(animate) {
    geo = measure();
    layer.style.height = geo.H + 'px';
    var plans = plan(geo);
    // reuse existing elements on a re-layout (resize): same icons, new places
    while (sprites.length > plans.length) { var gone = sprites.pop(); gone.el.remove(); }
    var frag = document.createDocumentFragment(), sy = window.pageYOffset;
    plans.forEach(function (p, i) {
      var sp = sprites[i];
      if (!sp) { sp = { el: makeSprite(i) }; sprites.push(sp); frag.appendChild(sp.el); }
      sp.el.style.width = sp.el.style.height = geo.s + 'px';
      sp.p = p; sp.rf = p.rf;
      if (animate) {
        sp.delay = i * 34 + rnd(0, 60);
        sp.x = p.x; sp.y = sy - geo.s * rnd(1.2, 3) - (i % 5) * 8;
        sp.vy = rnd(40, 220); sp.r = rnd(-38, 38); sp.w = rnd(-160, 160);
        sp.rest = false; sp.done = false; sp.o = 0;
        sp.el.style.opacity = '0';
      } else {
        sp.x = p.x; sp.y = p.restY; sp.r = sp.rf; sp.rest = sp.done = true;
        sp.el.style.opacity = '1';
      }
      place(sp);
    });
    layer.appendChild(frag);
    stats.mode = geo.mode; stats.count = sprites.length;
    watchZone();
  }

  // ---- the loop ------------------------------------------------------------------------------
  function frame(now) {
    raf = 0;
    if (!last) last = now;
    var dt = Math.min((now - last) / 1000, 1 / 30);
    stats.frames.push(Math.round(now - last));
    last = now;
    var t = now - t0, busy = false;
    for (var i = 0; i < sprites.length; i++) {
      var sp = sprites[i];
      if (sp.done) continue;
      busy = true;
      if (t < sp.delay) continue;
      if (sp.o < 1) { sp.o = Math.min(1, sp.o + dt * 9); sp.el.style.opacity = sp.o.toFixed(2); }
      if (!sp.rest) {
        sp.vy += G * dt;
        sp.y += sp.vy * dt;
        sp.r += sp.w * dt;
        // collision: never sink into the icon underneath, even while it is still falling
        var floorY = sp.p.restY, below = sp.p.below > -1 ? sprites[sp.p.below] : null;
        if (below && !below.rest) floorY = Math.min(floorY, below.y - geo.s * STEP);
        if (sp.y >= floorY) {
          sp.y = floorY;
          if (floorY === sp.p.restY && sp.vy > 320) { sp.vy = -sp.vy * BOUNCE; sp.w *= -0.4; }
          else if (floorY === sp.p.restY) { sp.vy = 0; sp.rest = true; }
          else sp.vy = below.vy;
        }
      } else {
        sp.r += (sp.rf - sp.r) * Math.min(1, dt * 12);
        if (Math.abs(sp.rf - sp.r) < 0.15 && sp.o >= 1) { sp.r = sp.rf; sp.done = true; }
      }
      place(sp);
    }
    if (busy) { schedule(); return; }
    stats.state = 'settled'; stats.settledAt = Math.round(now - t0);
    layer.classList.remove('is-live');
  }
  function schedule() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function pause() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }

  // pause while the pile region is off-screen
  function watchZone() {
    if (!zone) { zone = document.createElement('div'); zone.style.cssText = 'position:absolute;left:0;width:1px;pointer-events:none'; layer.appendChild(zone); }
    var reach = geo.mode === 'side' ? geo.max : geo.max + 40;
    zone.style.top = (geo.H - reach - geo.vh) + 'px';
    zone.style.height = (reach + geo.vh) + 'px';
    if (!zoneIo) {
      zoneIo = new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (stats.state === 'falling') { if (visible) { last = 0; schedule(); } else pause(); }
      });
      zoneIo.observe(zone);
    }
  }
  document.addEventListener('visibilitychange', function () {
    if (stats.state !== 'falling') return;
    if (document.hidden) pause(); else { last = 0; schedule(); }
  });

  function finishStatic() { pause(); build(false); stats.state = 'settled'; layer.classList.remove('is-live'); }

  // ---- start ---------------------------------------------------------------------------------
  function start() {
    var animate = force || (!reduce && !seen());
    remember();
    if (!animate) { build(false); stats.state = 'settled'; return; }
    stats.state = 'falling';
    layer.classList.add('is-live');
    build(true);
    t0 = performance.now(); last = 0;
    schedule();
  }
  // reached = in view, or already scrolled past (a jump to the end, a deep link, a restored scroll).
  // IntersectionObserver alone misses a jump from below the fold to above it, so a cheap scroll
  // check (one rect read per frame at most) backs it up.
  var armed = true, tick = 0;
  function check() {
    tick = 0;
    if (!armed || trigger.getBoundingClientRect().top > window.innerHeight) return;
    armed = false;
    tio.disconnect();
    window.removeEventListener('scroll', onScroll);
    start();
  }
  function onScroll() { if (!tick) tick = requestAnimationFrame(check); }
  var tio = new IntersectionObserver(function (en) { if (en[0].isIntersecting) check(); });
  tio.observe(trigger);
  window.addEventListener('scroll', onScroll, { passive: true });
  check();

  // ---- layout changes ------------------------------------------------------------------------
  // width change → re-lay the piles (settled, never over the text); height change (an FAQ answer
  // opened above) → the floor moved, so every icon moves with it.
  var lastW = document.documentElement.clientWidth, rz = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      var w = document.documentElement.clientWidth;
      if (w === lastW || stats.state === 'idle') return;
      lastW = w;
      finishStatic();
    }, 180);
  });
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      if (!geo || stats.state === 'idle') return;
      var H = docHeight();
      if (Math.abs(H - geo.H) < 1 || document.documentElement.clientWidth !== lastW) return;
      var d = H - geo.H;
      geo.H = H; geo.floor += d;
      layer.style.height = H + 'px';
      sprites.forEach(function (sp) { sp.y += d; sp.p.restY += d; place(sp); });
      watchZone();
    }).observe(document.body);
  }
})();
