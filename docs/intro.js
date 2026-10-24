/* Entrance choreography — plays once per page load, ≈2.8 s desktop / ≈2.4 s phone.
   (a) "YOUR AGENT" slams in   (b) the bottom headline writes itself, then the sub line
   (c) a burst of Messages icons rains, bounces on the floor and fades   (d) the pill rises.
   Contract:
   - Hidden start states live in style.css under html.intro. That class is set by a tiny inline
     script at the top of <body> (never with reduced motion or ?rm=1) together with a 4 s safety
     timer that removes it, so the page can never stay hidden if this file fails.
   - Only transform-type properties (scale / translate / rotate), opacity, and a short blur on
     the headline. WAAPI for the elements (compositor), one rAF loop for the rain.
   - Any click, key, touch or wheel ends it at once (final state, rain gone).
   - Test hook: ?t=<ms> freezes the choreography at that time (deterministic rain) for screenshots.
   - window.__icIntro = { frames:[ms deltas of the rain loop], done:boolean } for measurement. */
(function () {
  'use strict';
  var html = document.documentElement;
  if (!html.classList.contains('intro')) return;          // reduced motion, ?rm=1 or safety already fired
  clearTimeout(window.__icIntroSafety);

  var q = location.search;
  var tm = /[?&]t=(\d+)/.exec(q), FROZEN = tm ? +tm[1] : -1;
  var stats = window.__icIntro = { frames: [], done: false };
  var phone = window.matchMedia && matchMedia('(max-width: 820px), (max-height: 600px)').matches;
  var K = phone ? 0.85 : 1;                                  // phones: same beats, shorter

  var EASE_OUT = 'cubic-bezier(.23,1,.32,1)';               // strong ease-out (enter)
  var EXPO = 'cubic-bezier(.16,1,.3,1)';

  var anims = [], timers = [], raf = 0, done = false, rain = null, bottom = null, bottomText = '';
  var hardStop = 0;

  // ---- skip --------------------------------------------------------------------------------
  var EVTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
  function onSkip() { finish(); }
  EVTS.forEach(function (t) { window.addEventListener(t, onSkip, { passive: true, capture: true }); });
  document.addEventListener('visibilitychange', onVisibility);
  function onVisibility() { if (document.hidden) finish(); }

  function finish() {
    if (done) return;
    done = true;
    clearTimeout(window.__icIntroSafety);
    clearTimeout(hardStop);
    timers.forEach(clearTimeout);
    if (raf) cancelAnimationFrame(raf);
    anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    anims = [];
    if (rain && rain.parentNode) rain.parentNode.removeChild(rain);
    // the letter spans stay: swapping back to one text node would re-kern and nudge the line ~5 px
    html.classList.remove('intro');
    EVTS.forEach(function (t) { window.removeEventListener(t, onSkip, { capture: true }); });
    document.removeEventListener('visibilitychange', onVisibility);
    stats.done = true;
  }

  if (document.hidden || !document.body.animate) { finish(); return; }

  // ---- helpers -----------------------------------------------------------------------------
  // Damped spring sampled into keyframes: WAAPI then plays it off the main thread.
  function spring(from, to, k, d, fmt) {
    var x = from, v = 0, dt = 1 / 240, t = 0, pts = [];
    while (t < 1.6) {
      pts.push([t, x]);
      for (var i = 0; i < 4; i++) { v += (k * (to - x) - d * v) * dt; x += v * dt; }
      t += 4 * dt;
      if (Math.abs(to - x) < Math.abs(to - from) * 0.002 && Math.abs(v) < Math.abs(to - from) * 0.02) break;
    }
    pts.push([t, to]);
    var dur = t * 1000;
    return {
      dur: dur,
      frames: pts.map(function (p) { var o = {}; o.offset = p[0] / t; fmt(o, p[1]); return o; })
    };
  }
  function play(el, frames, opts) {
    if (!el) return null;
    opts.fill = 'both';
    var a = el.animate(frames, opts);
    anims.push(a);
    return a;
  }
  function after(ms, fn) { timers.push(setTimeout(fn, ms)); }

  function rnd(seed) {                                       // mulberry32 for ?t= determinism
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var R = FROZEN >= 0 ? rnd(7) : Math.random;

  // ---- start once the display faces are in (max 700 ms), so nothing swaps mid-animation -----
  var started = false;
  function start() {
    if (started || done) return;
    started = true;
    try { run(); } catch (e) { finish(); }
  }
  if (document.fonts && document.fonts.ready && document.fonts.status !== 'loaded') {
    document.fonts.ready.then(start, start);
    after(700, start);
  } else start();

  function run() {
    var top = document.querySelector('.hl__top');
    bottom = document.querySelector('.hl__bottom');
    var sub = document.querySelector('.foot .sub');
    var pill = document.querySelector('.pill');
    var row = pill ? Array.prototype.filter.call(pill.querySelectorAll('.pill__row > *'), function (n) {
      return !n.classList.contains('spacer');
    }) : [];
    var meta = document.querySelector('.center .meta');
    var end = 0;
    function track(delay, dur) { end = Math.max(end, delay + dur); }

    // (a) slam — heavy spring 1.15 → 1 (≈3 % overshoot), blur 8 → 0, opacity in 180 ms
    var slam = spring(1.15, 1, 190, 14, function (o, v) { o.scale = v.toFixed(4); });
    play(top, slam.frames, { duration: slam.dur, easing: 'linear' });
    play(top, [{ opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(3px)', offset: 0.45 }, { opacity: 1, filter: 'blur(0px)' }],
      { duration: 380, easing: EASE_OUT });
    if (top) top.classList.add('is-in');
    track(0, slam.dur);

    // (b) the bottom headline writes itself — letter spans only while animating
    var L0 = 380 * K, STEP = (phone ? 32 : 40), LDUR = 360;
    var letters = [];
    if (bottom) {
      bottomText = bottom.textContent;
      var frag = document.createDocumentFragment();
      bottomText.split(/( +)/).forEach(function (part) {
        if (!part) return;
        if (/^ +$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var w = document.createElement('span');
        w.className = 'w';
        Array.prototype.forEach.call(part, function (ch) {
          var s = document.createElement('span');
          s.className = 'l';
          s.textContent = ch;
          w.appendChild(s);
          letters.push(s);
        });
        frag.appendChild(w);
      });
      bottom.textContent = '';
      bottom.appendChild(frag);
      bottom.classList.add('is-split');
      letters.forEach(function (s, i) {
        play(s, [{ opacity: 0, translate: '0 .15em' }, { opacity: 1, translate: '0 0' }],
          { duration: LDUR, delay: L0 + i * STEP, easing: EASE_OUT });
      });
      track(L0 + (letters.length - 1) * STEP, LDUR);
    }
    var S0 = L0 + Math.max(0, letters.length - 1) * STEP + 120;
    play(sub, [{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }],
      { duration: 520, delay: S0, easing: EXPO });
    track(S0, 520);

    // (d) the pill rises on a spring, its shadow blooms, then the row staggers in
    var P0 = 520 * K;
    var rise = spring(40, 0, 300, 25, function (o, v) { o.translate = '0 ' + v.toFixed(2) + 'px'; });
    play(pill, rise.frames, { duration: rise.dur, delay: P0, easing: 'linear' });
    play(pill, [{ opacity: 0 }, { opacity: 1 }], { duration: 280, delay: P0, easing: EASE_OUT });
    if (pill) pill.classList.add('is-in');
    // shadow layer: CSS transition on .pill::before opacity, triggered by .is-bloom
    after(P0 + 120, function () { if (pill) pill.classList.add('is-bloom'); });
    track(P0, rise.dur);
    var R0 = P0 + 260 * K;
    row.forEach(function (el, i) {
      play(el, [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }],
        { duration: 420, delay: R0 + i * 70, easing: EXPO });
    });
    var M0 = R0 + row.length * 70;
    play(meta, [{ opacity: 0 }, { opacity: 1 }], { duration: 480, delay: M0, easing: EASE_OUT });
    track(M0, 480);

    // (c) burst of icons — physics in one rAF loop
    var rainEnd = startRain(phone ? 15 : 30 + Math.floor(R() * 8));
    end = Math.max(end, rainEnd);

    if (FROZEN >= 0) {
      anims.forEach(function (a) { a.pause(); a.currentTime = FROZEN; });
      if (pill && FROZEN < P0 + 120) pill.classList.remove('is-bloom');
      timers.forEach(clearTimeout);
      if (pill && FROZEN >= P0 + 120) pill.classList.add('is-bloom', 'is-instant');
      return;                                               // frozen: stays until a skip
    }
    hardStop = setTimeout(finish, end + 80);
  }

  // ---- rain ----------------------------------------------------------------------------------
  function startRain(n) {
    var box = document.querySelector('[data-trail]');
    var base = box ? box.getAttribute('data-trail') : 'assets/trail-imessage/';
    var webp = (function () {
      try { return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0; }
      catch (e) { return false; }
    })();
    var src = base + (webp ? 'messages-256.webp' : 'messages-256.png');
    var W = window.innerWidth, H = window.innerHeight;
    var G = (phone ? 2600 : 3000), R0 = 160 * K, FADE = 1200 * K, HOLD = 120;
    var drops = [];
    rain = document.createElement('div');
    rain.className = 'rain';
    rain.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < n; i++) {
      var size = phone ? 26 + R() * 16 : 34 + R() * 24;
      var d = {
        size: size,
        x: W * (0.04 + R() * 0.92), y: -size - R() * 60,
        vx: (R() - 0.5) * 60, vy: R() * 120,
        rot: (R() - 0.5) * 50, vr: (R() - 0.5) * 240,
        delay: R0 + R() * 600 * K,
        floor: H - size * 0.5 - R() * 22,
        bounces: 0, landed: -1, el: document.createElement('img')
      };
      d.el.alt = '';
      d.el.decoding = 'async';
      d.el.draggable = false;
      d.el.src = src;
      d.el.style.width = d.el.style.height = size.toFixed(1) + 'px';
      d.el.style.margin = (-size / 2).toFixed(1) + 'px 0 0 ' + (-size / 2).toFixed(1) + 'px';
      rain.appendChild(d.el);
      drops.push(d);
    }
    document.body.appendChild(rain);

    // integrate one drop to absolute time t (ms), fixed sub-steps → same result live or frozen
    function step(d, dt) {
      d.vy += G * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
      if (d.y >= d.floor && d.vy > 0) {
        d.y = d.floor;
        d.bounces++;
        d.vy = d.bounces < 3 ? -d.vy * (d.bounces === 1 ? 0.34 : 0.22) : 0;   // soft bounce, then rest
        d.vx *= 0.6; d.vr *= 0.45;
        if (Math.abs(d.vy) < 60) d.vy = 0;
      }
      if (d.vy === 0 && d.y >= d.floor) { d.vx *= 0.9; d.vr *= 0.85; if (d.landed < 0) d.landed = d.simT; }
    }
    function draw(d, t) {
      var local = t - d.delay;
      if (local < 0) { d.el.style.opacity = '0'; return; }
      var target = local / 1000;
      if (d.simT == null) d.simT = 0;
      while (d.simT < target) { var h = Math.min(1 / 240, target - d.simT); d.simT += h; step(d, h); }
      var op = Math.min(1, local / 120);
      if (d.landed >= 0) {
        var f = (local - d.landed * 1000 - HOLD) / FADE;
        if (f > 0) op = Math.max(0, 1 - f * (2 - f));          // ease-out fade
      }
      d.el.style.opacity = op.toFixed(3);
      d.el.style.transform = 'translate3d(' + d.x.toFixed(1) + 'px,' + d.y.toFixed(1) + 'px,0) rotate(' + d.rot.toFixed(1) + 'deg)';
    }
    function frame(t) { drops.forEach(function (d) { draw(d, t); }); }

    // worst case: last drop falls from ~-200 px to the floor, two small bounces, hold, fade
    var fall = Math.sqrt(2 * (H + 120) / G) * 1000;
    var endAt = R0 + 600 * K + fall + 420 + HOLD + FADE;

    if (FROZEN >= 0) { frame(FROZEN); return endAt; }
    var t0 = performance.now(), last = t0;
    function tick(now) {
      if (done) return;
      stats.frames.push(+(now - last).toFixed(2));
      last = now;
      var t = now - t0;
      frame(t);
      if (t < endAt) raf = requestAnimationFrame(tick);
      else { raf = 0; if (rain.parentNode) rain.parentNode.removeChild(rain); }
    }
    raf = requestAnimationFrame(tick);
    return endAt;
  }
})();
