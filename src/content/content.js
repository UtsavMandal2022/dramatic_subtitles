// Entry point — pure glue, loaded last. Wires storage state to the
// caption hider + cue watcher, and hooks SPA-navigation / fullscreen events.
(function () {
  const NS = window.__dramaticSubs;
  const C = NS.constants;

  // Only run on an actual title playback page (/watch/<id>). Netflix's
  // browse/home screen autoplays preview trailers that carry the same
  // caption container — without this check, "coming soon" hero previews
  // would get the dramatic treatment too, which is confusing and unwanted.
  function isWatchPage() {
    return /\/watch\//.test(location.pathname);
  }

  let userEnabled = C.DEFAULT_ENABLED;
  let active = false;

  function enable() {
    if (active) return;
    active = true;
    NS.captionHider.hide();
    NS.overlayRenderer.init();
    NS.cueWatcher.start();
    NS.debugLog('enabled');
  }

  function disable() {
    if (!active) return;
    active = false;
    NS.cueWatcher.stop();
    NS.overlayRenderer.clearAll();
    NS.captionHider.show();
    NS.debugLog('disabled');
  }

  function sync() {
    if (userEnabled && isWatchPage()) enable();
    else disable();
  }

  // Live toggle from the popup (storage.onChanged reaches every Netflix tab).
  NS.storage.onEnabledChanged((enabled) => {
    userEnabled = enabled;
    sync();
  });

  // SPA navigation: Netflix uses history.pushState — poll the URL as a
  // simple, page-world-free detection mechanism. Also re-evaluates whether
  // we've navigated into/out of a /watch/ page.
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      sync();
      if (active) NS.cueWatcher.handleNavigation();
    }
  }, C.URL_POLL_INTERVAL_MS);

  // Keep the overlay inside whatever element is fullscreened.
  document.addEventListener('fullscreenchange', () => {
    NS.overlayRenderer.reparent();
  });

  // Freeze overlay animations while the video is paused. Media events don't
  // bubble, but capture-phase listeners on document still receive them — and
  // this survives Netflix recreating the <video> element across episodes.
  document.addEventListener(
    'pause',
    (e) => {
      if (e.target instanceof HTMLVideoElement) NS.overlayRenderer.setPaused(true);
    },
    true
  );
  document.addEventListener(
    'play',
    (e) => {
      if (e.target instanceof HTMLVideoElement) NS.overlayRenderer.setPaused(false);
    },
    true
  );

  NS.storage.getEnabled().then((enabled) => {
    userEnabled = enabled;
    sync();
  });
})();
