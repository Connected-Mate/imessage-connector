/* iMessage Connector — more.html behaviour: section reveals on scroll and the film block.
   Fails safe: no JS → everything is visible (the hidden start states need html.rv, which only the
   inline gate sets, together with a 4 s safety timer); no IntersectionObserver → all revealed. */
(function () {
  'use strict';
  var html = document.documentElement;
  var reduce = /[?&]rm=1\b/.test(location.search) ||
    !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---- reveal, section by section ----------------------------------------------------------
  clearTimeout(window.__icRevealSafety);
  var blocks = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  blocks.forEach(function (b) {
    Array.prototype.forEach.call(b.children, function (c, i) { c.style.setProperty('--k', Math.min(i, 6)); });
  });
  function showAll() { blocks.forEach(function (b) { b.classList.add('is-in'); }); html.classList.remove('rv'); }
  if (!html.classList.contains('rv') || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    blocks.forEach(function (b) { io.observe(b); });
    // a jump (anchor, find-in-page, print) must never land on hidden text
    window.addEventListener('hashchange', function () {
      var t = document.getElementById(location.hash.slice(1));
      var s = t && t.closest('[data-reveal]');
      if (s) s.classList.add('is-in');
    });
    window.addEventListener('beforeprint', showAll);
  }

  // ---- film: muted teaser loop → the voiced film with captions on demand ---------------------
  var film = document.querySelector('[data-film]');
  if (!film) return;
  var teaser = film.querySelector('[data-teaser]');
  var full = film.querySelector('[data-full]');
  var watch = film.querySelector('[data-watch]');
  var loop = film.querySelector('[data-loop]');
  var userPaused = reduce, inView = false;

  function setLoopUi() {
    var paused = userPaused;
    loop.classList.toggle('is-paused', paused);
    loop.setAttribute('aria-label', loop.getAttribute(paused ? 'data-play' : 'data-pause'));
  }
  function tryPlay(v) { try { var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
  function syncTeaser() {
    if (film.classList.contains('is-full')) return;
    if (!userPaused && inView && !document.hidden) tryPlay(teaser); else teaser.pause();
  }
  setLoopUi();
  loop.addEventListener('click', function () { userPaused = !userPaused; setLoopUi(); syncTeaser(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { inView = en[0].isIntersecting; syncTeaser(); }, { threshold: 0.25 }).observe(film);
  } else { inView = true; syncTeaser(); }
  document.addEventListener('visibilitychange', syncTeaser);

  watch.addEventListener('click', function () {
    teaser.pause();
    film.classList.add('is-full');
    teaser.hidden = true;
    full.hidden = false;
    full.muted = false;
    full.volume = 1;
    try { if (full.textTracks && full.textTracks[0]) full.textTracks[0].mode = 'showing'; } catch (e) {}
    try { full.focus({ preventScroll: true }); } catch (e) { full.focus(); }
    tryPlay(full);  // if the browser refuses, the native controls are on screen: one more tap plays it
  });
})();
