/* iMessage Connector — page behaviour. Every feature fails safe: no storage, no clipboard,
   no JS → the prompt is still on screen and selectable. */
(function () {
  'use strict';
  var LANG_KEY = 'imessage-connector-lang';
  var root = document.documentElement;
  var reduce = /[?&]rm=1\b/.test(location.search) ||
    !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (/[?&]rm=1\b/.test(location.search)) root.classList.add('rm');
  var touch = !!(window.matchMedia && matchMedia('(hover: none), (pointer: coarse)').matches);
  var stage = document.querySelector('.stage') || root;
  var AGENT_KEY = 'imessage-connector-agent';
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // Explicit language choice wins over the browser language on the next visit.
  document.querySelectorAll('[data-lang]').forEach(function (a) {
    a.addEventListener('click', function () { store(LANG_KEY, a.getAttribute('data-lang')); });
  });

  // ---- toast (one live region, re-announced on every action) ------------------------------
  var toast = document.querySelector('[data-toast]');
  var toastTimer = null;
  function say(msg, ms) {
    if (!toast) return;
    toast.textContent = '';
    toast.classList.remove('is-on');
    // a tick so screen readers notice the same message twice in a row
    setTimeout(function () { toast.textContent = msg; toast.classList.add('is-on'); }, 30);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, ms || 2600);
  }

  // ---- agent picker: button + listbox (APG "select-only combobox"-style, single focus) ----
  var picker = document.querySelector('[data-picker]');
  var current = { name: 'Claude Code', a: '#0a0a0a', b: '#0a0a0a' };
  if (picker) initPicker(picker);

  function initPicker(root) {
    var btn = root.querySelector('.picker__btn');
    var label = root.querySelector('[data-picker-label]');
    var list = root.querySelector('[role="listbox"]');
    var opts = Array.prototype.slice.call(list.querySelectorAll('[role="option"]'));
    var thumb = document.querySelector('[data-thumb]');
    var active = 0;
    var typed = '', typedTimer = null;

    function select(i, silent) {
      opts.forEach(function (o, j) { o.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
      var o = opts[i];
      current.name = o.getAttribute('data-name');
      label.textContent = current.name;
      if (thumb) thumb.innerHTML = o.querySelector('.thumb').innerHTML;
      current.a = o.getAttribute('data-accent') || '#0a0a0a';
      current.b = o.getAttribute('data-accent2') || current.a;
      stage.style.setProperty('--agent', current.a);
      stage.style.setProperty('--agent2', current.b);
      if (!silent) store(AGENT_KEY, current.name);
    }
    function setActive(i) {
      active = (i + opts.length) % opts.length;
      opts.forEach(function (o, j) { o.classList.toggle('is-active', j === active); });
      list.setAttribute('aria-activedescendant', opts[active].id);
      if (list.scrollHeight > list.clientHeight + 1 && opts[active].scrollIntoView) opts[active].scrollIntoView({ block: 'nearest' });
    }
    list.style.setProperty('--n', opts.length);
    function open(byKey) {
      if (!list.hidden) return;
      // pointer opens: items fall in one by one; keyboard opens stay instant (repeated, deliberate)
      list.classList.remove('is-anim');
      if (!byKey && !reduce) { void list.offsetWidth; list.classList.add('is-anim'); }
      list.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      // flip up when there is no room below
      list.classList.remove('is-up');
      list.style.maxHeight = '';
      var r = list.getBoundingClientRect(), b = btn.getBoundingClientRect(), H = window.innerHeight;
      var below = H - b.bottom - 14, above = b.top - 14;
      if (r.height > below && above > below) list.classList.add('is-up');
      // neither side fits (short phones): the list scrolls inside itself, the page never jumps
      var room = list.classList.contains('is-up') ? above : below;
      if (r.height > room) list.style.maxHeight = Math.max(160, Math.floor(room)) + 'px';
      setActive(opts.findIndex(function (o) { return o.getAttribute('aria-selected') === 'true'; }));
      try { list.focus({ preventScroll: true }); } catch (e) { list.focus(); }
    }
    function close(refocus) {
      if (list.hidden) return;
      list.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (refocus) btn.focus();
    }
    btn.addEventListener('click', function (ev) { list.hidden ? open(ev.detail === 0) : close(true); });
    btn.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); open(true); }
    });
    list.addEventListener('keydown', function (ev) {
      var k = ev.key;
      if (k === 'ArrowDown') { ev.preventDefault(); setActive(active + 1); }
      else if (k === 'ArrowUp') { ev.preventDefault(); setActive(active - 1); }
      else if (k === 'Home') { ev.preventDefault(); setActive(0); }
      else if (k === 'End') { ev.preventDefault(); setActive(opts.length - 1); }
      else if (k === 'Enter' || k === ' ') { ev.preventDefault(); select(active); close(true); }
      else if (k === 'Escape') { ev.preventDefault(); close(true); }
      else if (k === 'Tab') { close(false); }
      else if (k.length === 1 && /\S/.test(k)) {
        typed += k.toLowerCase();
        clearTimeout(typedTimer);
        typedTimer = setTimeout(function () { typed = ''; }, 600);
        var hit = opts.findIndex(function (o) { return o.getAttribute('data-name').toLowerCase().indexOf(typed) === 0; });
        if (hit > -1) setActive(hit);
      }
    });
    opts.forEach(function (o, i) {
      o.addEventListener('click', function () { select(i); close(true); });
      o.addEventListener('pointermove', function () { if (active !== i) setActive(i); });
    });
    document.addEventListener('pointerdown', function (ev) { if (!root.contains(ev.target)) close(false); });
    list.addEventListener('focusout', function (ev) { if (!root.contains(ev.relatedTarget)) close(false); });

    var saved = load(AGENT_KEY);
    var idx = opts.findIndex(function (o) { return o.getAttribute('data-name') === saved; });
    select(idx > -1 ? idx : 0, true);
  }

  // ---- copy the prompt -------------------------------------------------------------------
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    var okTimer = null;
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      function done() {
        btn.classList.add('is-ok');
        if (btn.classList.contains('go')) wave(btn);
        clearTimeout(okTimer); // rapid clicks extend the confirmation instead of stacking
        okTimer = setTimeout(function () { btn.classList.remove('is-ok', 'is-fill'); }, 2000);
        say((btn.getAttribute('data-copied') || 'Copied').replace('{agent}', current.name));
      }
      function manual() {
        if (legacyCopy(text)) { done(); return; }
        // phones: the share sheet has "Copy" (and AirDrop to the Mac), better than a selection
        if (touch && navigator.share) {
          navigator.share({ text: text }).then(function () {}, function () {});
          return;
        }
        var code = document.querySelector('[data-prompt]');
        if (code && window.getSelection) {
          var range = document.createRange();
          range.selectNodeContents(code);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        if (touch) { say(btn.getAttribute('data-manual-touch') || btn.getAttribute('data-manual') || 'Selected', 5000); return; }
        var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
        say((btn.getAttribute('data-manual') || 'Press {key}').replace('{key}', mac ? '⌘C' : 'Ctrl+C'), 5000);
      }
      // Safari (iPhone above all) only copies inside the tap itself: the synchronous copy goes
      // first, so nothing depends on a promise that may settle after the gesture has expired.
      if (legacyCopy(text)) { done(); return; }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext !== false) {
          navigator.clipboard.writeText(text).then(done, manual);
        } else { manual(); }
      } catch (e) { manual(); }
    });
  });

  // ---- copy wave: one sweep of the agent's colours across both headlines, then the button ----
  // Every target paints the same viewport-wide gradient through background-clip:text, offset by
  // its own position, so the band reads as one continuous wave across separate letter spans.
  // Only background-position moves (one WAAPI animation per target, all on the same clock).
  var waveAnims = [], waveTimer = null;
  var WAVE_MS = 1200, WAVE_EASE = [0.3, 0.15, 0.25, 1];        // soft ease-out: the band stays readable
  function bezierY(x, p) {                                      // y(x) of a CSS cubic-bezier
    var lo = 0, hi = 1, t = x;
    for (var i = 0; i < 24; i++) {
      t = (lo + hi) / 2;
      var bx = 3 * (1 - t) * (1 - t) * t * p[0] + 3 * (1 - t) * t * t * p[2] + t * t * t;
      if (bx < x) lo = t; else hi = t;
    }
    return 3 * (1 - t) * (1 - t) * t * p[1] + 3 * (1 - t) * t * t * p[3] + t * t * t;
  }
  function timeAt(progress) {                                   // first time the eased curve reaches progress
    for (var i = 0; i <= 100; i++) if (bezierY(i / 100, WAVE_EASE) >= progress) return i / 100;
    return 1;
  }
  function lum(hex) {
    var c = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.substr(i, 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function stopWave() {
    waveAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    waveAnims = [];
    clearTimeout(waveTimer);
    root.classList.remove('is-waving', 'is-tinted');
  }
  function wave(btn) {
    stopWave();
    var a = current.a, b = current.b;
    // the more visible of the two colours carries the band (black brands: their grey)
    var hi = lum(a) >= lum(b) ? a : b, lo = hi === a ? b : a;
    stage.style.setProperty('--tint', hi);
    if (reduce || !document.body.animate) {
      btn.classList.add('is-fill');
      btn.style.setProperty('--fill-delay', '0ms');
      root.classList.add('is-tinted');
      waveTimer = setTimeout(stopWave, 2000);
      return;
    }
    var VW = window.innerWidth, G = VW * 3, ink = '#0a0a0a';
    var band = 'linear-gradient(90deg,' + ink + ' 0%,' + ink + ' 40%,' + lo + ' 44%,' + hi + ' 48%,' + hi + ' 52%,' +
      lo + ' 56%,' + ink + ' 60%,' + ink + ' 100%)';
    root.style.setProperty('--wave', band);
    root.style.setProperty('--wave-w', G + 'px');
    root.classList.add('is-waving');
    var bottom = document.querySelector('.hl__bottom');
    var targets = [document.querySelector('.hl__top')];
    if (bottom) {
      var letters = bottom.querySelectorAll('.l');
      if (letters.length) Array.prototype.push.apply(targets, letters); else targets.push(bottom);
    }
    // other pages opt headlines into the sweep with [data-wave] (none on the landing)
    Array.prototype.push.apply(targets, document.querySelectorAll('[data-wave]'));
    var c0 = -0.3 * VW, c1 = 1.3 * VW;                         // band centre: off-screen left → right
    targets.forEach(function (el) {
      if (!el) return;
      var left = el.getBoundingClientRect().left;
      var x0 = c0 - G / 2 - left, x1 = c1 - G / 2 - left;
      try {
        waveAnims.push(el.animate([{ backgroundPosition: x0 + 'px 0' }, { backgroundPosition: x1 + 'px 0' }],
          { duration: WAVE_MS, easing: 'cubic-bezier(' + WAVE_EASE.join(',') + ')', fill: 'both' }));
      } catch (e) {}
    });
    // the button fills with the agent gradient when the band reaches it
    var r = btn.getBoundingClientRect();
    var reach = Math.min(1, Math.max(0, (r.left + r.width * 0.3 - c0) / (c1 - c0)));
    btn.style.setProperty('--fill-delay', Math.round(timeAt(reach) * WAVE_MS * 0.85) + 'ms');
    btn.classList.add('is-fill');
    waveTimer = setTimeout(stopWave, WAVE_MS + 40);
  }
  window.__icWave = { stop: stopWave };

  // Textarea + execCommand, the iOS-safe way: read-only (no keyboard), 16 px (no zoom), off the
  // layout, selected with a range AND setSelectionRange (iOS ignores select() alone), focus and
  // scroll put back after.
  function legacyCopy(text) {
    var ta = null, prev = document.activeElement, x = window.pageXOffset, y = window.pageYOffset;
    try {
      ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.setAttribute('aria-hidden', 'true');
      ta.setAttribute('tabindex', '-1');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;margin:0;opacity:0;font-size:16px;pointer-events:none';
      document.body.appendChild(ta);
      var sel = window.getSelection ? window.getSelection() : null;
      if (sel) {
        var range = document.createRange();
        range.selectNodeContents(ta);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = !!(document.execCommand && document.execCommand('copy'));
      if (sel) sel.removeAllRanges();
      return ok;
    } catch (e) {
      return false;
    } finally {
      if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
      try { if (prev && prev.focus) prev.focus({ preventScroll: true }); } catch (e) {}
      if (window.pageYOffset !== y || window.pageXOffset !== x) window.scrollTo(x, y);
    }
  }
})();
