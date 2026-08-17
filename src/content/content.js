// Entry point — pure glue, loaded last. Wires storage state to the
// caption hider + cue watcher, and hooks SPA-navigation / fullscreen events.
(function () {
  const NS = window.__dramaticSubs;
  const C = NS.constants;

  function enable() {
    NS.captionHider.hide();
    NS.overlayRenderer.init();
    NS.cueWatcher.start();
    NS.debugLog('enabled');
  }

  function disable() {
    NS.cueWatcher.stop();
    NS.overlayRenderer.clearAll();
    NS.captionHider.show();
    NS.debugLog('disabled');
  }

  // Live toggle from the popup (storage.onChanged reaches every Netflix tab).
  NS.storage.onEnabledChanged((enabled) => (enabled ? enable() : disable()));

  // SPA navigation: Netflix uses history.pushState — poll the URL as a
  // simple, page-world-free detection mechanism.
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      NS.cueWatcher.handleNavigation();
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
    if (enabled) enable();
  });
})();
