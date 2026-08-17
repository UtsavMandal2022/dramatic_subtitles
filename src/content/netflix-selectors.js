// The ONLY file with Netflix DOM knowledge. If Netflix changes its markup,
// patch the selector lists here (and mirror the container selector in
// styles/hide-native-captions.css — CSS can't read these constants).
(function () {
  const NS = window.__dramaticSubs;

  // Ordered candidates, most-current-known first. Verify live in DevTools:
  // play a title with CC on and element-pick the caption text.
  const timedtextContainerSelectors = ['.player-timedtext'];
  const timedtextLineSelectors = ['.player-timedtext-text-container'];
  const playerRootSelectors = ['.watch-video', '[data-uia="player"]'];

  function findFirst(selectors, label) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (_) {
        // invalid selector string — skip
      }
    }
    NS.debugLog(`selector miss: no match for ${label}`, selectors);
    return null;
  }

  // Netflix can have MORE THAN ONE caption container in the DOM at once
  // (e.g. it may spin up a fresh one on player-mode changes like fullscreen
  // while the old one lingers, empty). Callers that track cues must watch
  // all of them, not just the first.
  function findAll(selectors, label) {
    for (const sel of selectors) {
      try {
        const els = document.querySelectorAll(sel);
        if (els.length) return Array.from(els);
      } catch (_) {
        // invalid selector string — skip
      }
    }
    NS.debugLog(`selector miss: no match for ${label}`, selectors);
    return [];
  }

  NS.selectors = {
    timedtextContainerSelectors,
    timedtextLineSelectors,
    playerRootSelectors,
    findTimedtextContainer: () =>
      findFirst(timedtextContainerSelectors, 'timedtext container'),
    findAllTimedtextContainers: () =>
      findAll(timedtextContainerSelectors, 'timedtext containers'),
    findPlayerRoot: () => findFirst(playerRootSelectors, 'player root'),
  };
})();
