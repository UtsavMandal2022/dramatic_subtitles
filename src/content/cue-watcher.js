// Detects subtitle cue start/end by observing Netflix's timedtext container.
// Coarse body-level observer finds/re-finds the container (SPA nav, ad
// breaks, episode auto-play all destroy and recreate it); a focused observer
// on the container diffs its text to emit start/end events.
(function () {
  const NS = window.__dramaticSubs;
  const C = NS.constants;

  let running = false;
  let container = null;
  let coarseObserver = null;
  let focusedObserver = null;
  let searchTimer = null;
  let rafPending = false;
  let lastCueText = '';
  let lastStyle = null;

  function normalize(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function extractText() {
    if (!container || !container.isConnected) return '';
    // Must be textContent, NOT innerText: our own hide-native-captions.css
    // sets visibility:hidden on this container, and innerText excludes
    // visibility-hidden text — innerText would always read as empty here.
    const lines = [];
    for (const sel of NS.selectors.timedtextLineSelectors) {
      container.querySelectorAll(sel).forEach((el) => {
        lines.push(el.textContent);
      });
      if (lines.length) break;
    }
    const raw = lines.length ? lines.join(' ') : container.textContent;
    return normalize(raw);
  }

  function processChange() {
    rafPending = false;
    if (!running) return;

    const text = extractText();
    if (text === lastCueText) return; // same line re-rendered — no-op

    if (text === '') {
      NS.debugLog('cue end');
      NS.overlayRenderer.hideCue(lastStyle);
    } else {
      NS.debugLog('cue start:', text);
      lastStyle = NS.styleEngine.pickStyle(text, NS.overlayRenderer.playerWidth());
      NS.overlayRenderer.showCue(text, lastStyle);
    }
    lastCueText = text;
  }

  function scheduleProcess() {
    // Netflix mutates several nested nodes per logical cue change — collapse
    // each burst into one pass on the next frame.
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(processChange);
  }

  function attachFocusedObserver(el) {
    detachFocusedObserver();
    container = el;
    focusedObserver = new MutationObserver(scheduleProcess);
    focusedObserver.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    NS.debugLog('attached to timedtext container', el);
    scheduleProcess(); // pick up any cue already on screen
  }

  function detachFocusedObserver() {
    if (focusedObserver) {
      focusedObserver.disconnect();
      focusedObserver = null;
    }
    container = null;
  }

  function checkContainer() {
    if (!running) return;
    if (container && container.isConnected) return;

    // Held reference went stale (or we never had one) — re-search.
    if (container && !container.isConnected) {
      NS.debugLog('container left the DOM — re-arming');
      detachFocusedObserver();
      lastCueText = '';
      NS.overlayRenderer.clearAll();
    }
    const found = NS.selectors.findTimedtextContainer();
    if (found) attachFocusedObserver(found);
  }

  NS.cueWatcher = {
    start() {
      if (running) return;
      running = true;
      lastCueText = '';

      coarseObserver = new MutationObserver(() => checkContainer());
      coarseObserver.observe(document.body, { childList: true, subtree: true });
      // Interval backstop in case a mutation burst is missed.
      searchTimer = setInterval(checkContainer, C.CONTAINER_SEARCH_INTERVAL_MS);
      checkContainer();
    },

    stop() {
      running = false;
      if (coarseObserver) {
        coarseObserver.disconnect();
        coarseObserver = null;
      }
      if (searchTimer) {
        clearInterval(searchTimer);
        searchTimer = null;
      }
      detachFocusedObserver();
      lastCueText = '';
      lastStyle = null;
    },

    handleNavigation() {
      if (!running) return;
      NS.debugLog('SPA navigation — resetting');
      detachFocusedObserver();
      lastCueText = '';
      lastStyle = null;
      NS.styleEngine.reset();
      NS.overlayRenderer.clearAll();
      checkContainer();
    },
  };
})();
