/* Heart easter egg — draw a heart (mouse, finger or pen) anywhere on the landing and a small
   thank-you pill pops up near the pointer, with a burst of Messages icons. Once per visit.
   Recogniser: the pointer path is resampled to 64 points, scaled into a square box and
   translated to its centroid (no rotation: hearts are upright), then compared point-to-point
   ($1-style path distance) with heart templates in both drawing directions, every start point.
   Shape checks then reject look-alikes: two upper lobes with a dip between them, one low
   point in the middle, a closed-ish path, sane aspect ratio and path length.
   Mouse: rolling 3 s window, a pause over 250 ms starts a new segment. Touch/pen: one stroke
   while pressed. Decorative and optional: any failure leaves the page untouched.
   Test hook: window.__icHeart = { score(points), THRESHOLD, reset() }. */
(function () {
  'use strict';
  var cfg = document.querySelector('[data-heart]');
  if (!cfg || !window.addEventListener) return;
  var KEY = 'imessage-connector-heart';
  var reduce = /[?&]rm=1\b/.test(location.search) ||
    !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function seen() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function mark() { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} }

  var N = 64, SIZE = 250, HALF_DIAG = 0.5 * Math.sqrt(2 * SIZE * SIZE);
  var THRESHOLD = 0.85;
  var WINDOW_MS = 3000, PAUSE_MS = 250;

  // ---- geometry ------------------------------------------------------------------------------
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function pathLength(p) { var d = 0; for (var i = 1; i < p.length; i++) d += dist(p[i - 1], p[i]); return d; }
  function resample(src, n) {
    var pts = src.map(function (p) { return { x: p.x, y: p.y }; });
    var I = pathLength(pts) / (n - 1), D = 0, out = [{ x: pts[0].x, y: pts[0].y }];
    if (!(I > 0)) return null;
    for (var i = 1; i < pts.length; i++) {
      var d = dist(pts[i - 1], pts[i]);
      if (D + d >= I && d > 0) {
        var q = { x: pts[i - 1].x + ((I - D) / d) * (pts[i].x - pts[i - 1].x),
                  y: pts[i - 1].y + ((I - D) / d) * (pts[i].y - pts[i - 1].y) };
        out.push(q);
        pts.splice(i, 0, q);
        D = 0;
      } else D += d;
    }
    while (out.length < n) out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    return out.slice(0, n);
  }
  function bbox(p) {
    var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    p.forEach(function (q) {
      if (q.x < b.x0) b.x0 = q.x; if (q.x > b.x1) b.x1 = q.x;
      if (q.y < b.y0) b.y0 = q.y; if (q.y > b.y1) b.y1 = q.y;
    });
    b.w = b.x1 - b.x0; b.h = b.y1 - b.y0;
    return b;
  }
  function normalise(p) {                                     // square box, centroid at origin
    var b = bbox(p), cx = 0, cy = 0;
    var q = p.map(function (r) { return { x: (r.x - b.x0) * SIZE / (b.w || 1), y: (r.y - b.y0) * SIZE / (b.h || 1) }; });
    q.forEach(function (r) { cx += r.x; cy += r.y; });
    cx /= q.length; cy /= q.length;
    return q.map(function (r) { return { x: r.x - cx, y: r.y - cy }; });
  }

  // ---- templates: x = 16 sin³t, y = −(13 cos t − 5 cos 2t − 2 cos 3t − cos 4t) (screen y down)
  function heartPath(t0, dir) {
    var p = [];
    for (var i = 0; i <= 128; i++) {
      var t = t0 + dir * (i / 128) * 2 * Math.PI, s = Math.sin(t);
      p.push({ x: 16 * s * s * s, y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) });
    }
    return normalise(resample(p, N));
  }
  var TEMPLATES = [heartPath(0, 1), heartPath(0, -1), heartPath(Math.PI, 1), heartPath(Math.PI, -1)];

  function pathDistance(a, b, shift) {
    var d = 0;
    for (var i = 0; i < N; i++) d += dist(a[(i + shift) % N], b[i]);
    return d / N;
  }

  // Shape checks on the candidate in a 0..1 box (y down). Returns the reason it failed, or ''.
  function shapeCheck(raw, b) {
    if (b.w < 40 || b.h < 40) return 'small';
    var ar = b.w / b.h;
    if (ar < 0.55 || ar > 1.9) return 'aspect';
    if (dist(raw[0], raw[raw.length - 1]) > 0.38 * Math.max(b.w, b.h)) return 'open';
    var len = pathLength(raw) / (2 * (b.w + b.h));
    if (len < 0.7 || len > 1.9) return 'length';
    var u = raw.map(function (r) { return { x: (r.x - b.x0) / b.w, y: (r.y - b.y0) / b.h }; });
    var left = 1, right = 1, mid = 1, low = null;
    u.forEach(function (r) {
      if (r.x < 0.4 && r.y < left) left = r.y;
      if (r.x > 0.6 && r.y < right) right = r.y;
      if (!low || r.y > low.y) low = r;
    });
    // the dip: highest place where the path crosses the vertical centre line, upper part only
    for (var i = 1; i < u.length; i++) {
      var a = u[i - 1], c = u[i];
      if ((a.x - 0.5) * (c.x - 0.5) > 0 || a.x === c.x) continue;
      var y = a.y + (c.y - a.y) * (0.5 - a.x) / (c.x - a.x);
      if (y < 0.7 && y < mid) mid = y;
    }
    if (left > 0.3 || right > 0.3) return 'lobes';
    if (mid - Math.max(left, right) < 0.08) return 'dip';
    if (low.x < 0.28 || low.x > 0.72) return 'point';
    var spread = u.filter(function (r) { return r.y > 0.88; });
    var sb = bbox(spread);
    if (sb.w > 0.4) return 'flat-bottom';
    return '';
  }

  function score(points) {
    var res = { score: 0, reason: 'few-points' };
    if (!points || points.length < 12) return res;
    var b = bbox(points);
    var rs = resample(points, N);
    if (!rs) return res;
    var c = normalise(rs), best = Infinity;
    TEMPLATES.forEach(function (t) {
      for (var s = 0; s < N; s += 2) { var d = pathDistance(c, t, s); if (d < best) best = d; }
    });
    res.score = +(1 - best / HALF_DIAG).toFixed(3);
    res.reason = shapeCheck(rs, b);
    res.match = !res.reason && res.score >= THRESHOLD;
    return res;
  }

  // Best match among the whole segment and its closed suffixes (a heart drawn mid-movement).
  function detect(seg) {
    if (seg.length < 12) return null;
    var last = seg[seg.length - 1], best = null, tried = 0;
    var b = bbox(seg), tol = 0.38 * Math.max(b.w, b.h, 40);
    var step = Math.max(1, Math.floor(seg.length / 24));
    for (var i = 0; i < seg.length - 12 && tried < 10; i += step) {
      if (i > 0 && dist(seg[i], last) > tol) continue;
      if (last.t - seg[i].t < 250) break;
      tried++;
      var r = score(seg.slice(i));
      if (r.match && (!best || r.score > best.score)) best = r;
    }
    return best;
  }

  // ---- input ---------------------------------------------------------------------------------
  var seg = [], idle = 0, lastEval = 0, stroke = null, fired = false;
  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }

  function onMouse(ev) {
    if (fired || ev.pointerType !== 'mouse') return;
    var t = ev.timeStamp || now();
    var prev = seg[seg.length - 1];
    if (prev && t - prev.t > PAUSE_MS) { evaluate(seg); seg = []; }
    seg.push({ x: ev.clientX, y: ev.clientY, t: t });
    while (seg.length && t - seg[0].t > WINDOW_MS) seg.shift();
    clearTimeout(idle);
    idle = setTimeout(function () { evaluate(seg); seg = []; }, PAUSE_MS);
    if (t - lastEval > 90) { lastEval = t; evaluate(seg, true); }
  }
  function evaluate(points, live) {
    if (fired || !points.length) return;
    var hit = detect(points);
    if (hit) { seg = []; stroke = null; trigger(points[points.length - 1]); }
  }
  // touch & pen: pointer events while pressed; touch events too, because a pointer stream can be
  // cancelled when the browser takes the gesture for scrolling (duplicates are harmless)
  function down(x, y, t) { if (!fired) stroke = [{ x: x, y: y, t: t }]; }
  function move(x, y, t) { if (stroke) stroke.push({ x: x, y: y, t: t }); }
  function up() { if (!stroke) return; var s = stroke; stroke = null; evaluate(s); }
  function onPDown(ev) { if (ev.pointerType !== 'mouse') down(ev.clientX, ev.clientY, ev.timeStamp || now()); }
  function onPMove(ev) { if (ev.pointerType !== 'mouse') move(ev.clientX, ev.clientY, ev.timeStamp || now()); }
  function onPUp(ev) { if (ev.pointerType !== 'mouse') up(); }
  function onTStart(ev) { var p = ev.touches && ev.touches[0]; if (p && ev.touches.length === 1 && !stroke) down(p.clientX, p.clientY, ev.timeStamp || now()); }
  function onTMove(ev) { var p = ev.touches && ev.touches[0]; if (p) move(p.clientX, p.clientY, ev.timeStamp || now()); }
  function onTEnd(ev) { if (!ev.touches || !ev.touches.length) up(); }

  var opt = { passive: true };
  var L = [['pointermove', onMouse], ['pointermove', onPMove], ['pointerdown', onPDown], ['pointerup', onPUp],
    ['touchstart', onTStart], ['touchmove', onTMove], ['touchend', onTEnd], ['touchcancel', onTEnd]];
  function listen(on) { L.forEach(function (l) { (on ? window.addEventListener : window.removeEventListener).call(window, l[0], l[1], opt); }); }
  if (!seen()) listen(true);

  // ---- the pill ------------------------------------------------------------------------------
  var pop = null, status = null, returnTo = null;
  function trigger(at) {
    if (fired) return;
    fired = true;
    mark();
    listen(false);
    clearTimeout(idle);
    try { show(at); if (!reduce) burst(at); } catch (e) {}
  }
  function show(at) {
    status = document.createElement('p');
    status.className = 'sr-only';
    status.setAttribute('role', 'status');
    document.body.appendChild(status);

    pop = document.createElement('div');
    pop.className = 'heart-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'false');
    pop.setAttribute('aria-label', cfg.getAttribute('data-label') || '');
    pop.tabIndex = -1;
    var a = document.createElement('a');
    a.href = cfg.getAttribute('data-href');
    a.rel = 'noopener';
    a.textContent = cfg.getAttribute('data-text');
    var x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', cfg.getAttribute('data-close') || 'Close');
    x.innerHTML = '<span aria-hidden="true">×</span>';
    x.addEventListener('click', hide);
    pop.appendChild(a);
    pop.appendChild(x);
    document.body.appendChild(pop);

    // near the pointer: centred above it, or below when there is no room, inside a 16 px margin
    var r = pop.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight, M = 16;
    var left = Math.min(Math.max(at.x - r.width / 2, M), Math.max(M, W - r.width - M));
    var top = at.y - r.height - 28;
    if (top < M) top = Math.min(at.y + 28, H - r.height - M);
    pop.style.left = left + 'px';
    pop.style.top = Math.max(M, top) + 'px';

    returnTo = document.activeElement;
    document.addEventListener('keydown', onKey, true);
    requestAnimationFrame(function () {
      if (!pop) return;
      pop.classList.add('is-on');
      try { pop.focus({ preventScroll: true }); } catch (e) { pop.focus(); }
      setTimeout(function () { if (status) status.textContent = cfg.getAttribute('data-text'); }, 60);
    });
  }
  function onKey(ev) { if (ev.key === 'Escape' && pop) { ev.preventDefault(); hide(); } }
  function hide() {
    if (!pop) return;
    var p = pop, s = status;
    pop = status = null;
    document.removeEventListener('keydown', onKey, true);
    var hadFocus = p.contains(document.activeElement);
    p.classList.remove('is-on');
    setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); if (s && s.parentNode) s.parentNode.removeChild(s); }, reduce ? 0 : 260);
    if (hadFocus && returnTo && returnTo !== document.body && document.contains(returnTo)) {
      try { returnTo.focus({ preventScroll: true }); } catch (e) {}
    } else if (hadFocus) { document.activeElement.blur(); }
  }

  // ---- confetti: ~12 Messages icons thrown up from the pointer, gravity sampled into keyframes --
  function burst(at) {
    if (!document.body.animate) return;
    var base = cfg.getAttribute('data-img') || 'assets/trail-imessage/';
    var webp = false;
    try { webp = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) {}
    var box = document.createElement('div');
    box.className = 'confetti';
    box.setAttribute('aria-hidden', 'true');
    document.body.appendChild(box);
    var G = 1500, DUR = 1100, n = 12, end = 0;
    for (var i = 0; i < n; i++) {
      var img = document.createElement('img');
      img.src = base + (webp ? 'messages-256.webp' : 'messages-256.png');
      img.alt = '';
      img.draggable = false;
      box.appendChild(img);
      var ang = (-90 + (i / (n - 1) - 0.5) * 150 + (Math.random() - 0.5) * 14) * Math.PI / 180;
      var sp = 420 + Math.random() * 260, vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
      var rot = (Math.random() - 0.5) * 540, sc = 0.7 + Math.random() * 0.5, frames = [];
      for (var k = 0; k <= 12; k++) {
        var f = k / 12, t = f * DUR / 1000;
        frames.push({
          offset: f,
          transform: 'translate(' + (at.x + vx * t).toFixed(1) + 'px,' + (at.y + vy * t + 0.5 * G * t * t).toFixed(1) + 'px) rotate(' +
            (rot * f).toFixed(1) + 'deg) scale(' + (f < 0.12 ? (0.4 + f / 0.12 * (sc - 0.4)) : sc).toFixed(3) + ')',
          opacity: f < 0.6 ? 1 : +(1 - (f - 0.6) / 0.4).toFixed(3)
        });
      }
      var d = DUR * (0.85 + Math.random() * 0.25);
      end = Math.max(end, d);
      img.animate(frames, { duration: d, easing: 'linear', fill: 'both' });
    }
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, end + 60);
  }

  window.__icHeart = {
    score: score, detect: detect, THRESHOLD: THRESHOLD,
    reset: function () { try { sessionStorage.removeItem(KEY); } catch (e) {} if (pop) hide(); fired = false; seg = []; stroke = null; listen(false); listen(true); },
    fired: function () { return fired; }
  };
})();
