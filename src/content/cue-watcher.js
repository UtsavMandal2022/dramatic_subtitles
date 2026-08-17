// Detects subtitle cue start/end by observing Netflix's timedtext containers.
// A coarse body-level observer + interval backstop keeps the set of observed
// containers current (SPA nav, ad breaks, episode auto-play, AND player-mode
// changes like fullscreen can all destroy, recreate, or DUPLICATE the
// container — Netflix sometimes leaves a stale empty container in the DOM
// while rendering captions into a new one, so we must watch every match, not
// just the first).
(function () {
  const NS = window.__dramaticSubs;
  const C = NS.constants;

  let running = false;
  // Every currently-observed container element → its MutationObserver.
  const observed = new Map();
  let coarseObserver = null;
  let searchTimer = null;
  let rafPending = false;
  let lastCueText = '';
  let lastStyle = null;

  function normalize(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  // Aggregate visible cue text across ALL observed containers (normally only
  // one is active; stale ones are empty). Must be textContent, NOT innerText:
  // our own hide-native-captions.css sets visibility:hidden on these
  // containers, and innerText excludes visibility-hidden text.
  function extractText() {
    const parts = [];
    for (const container of observed.keys()) {
      if (!container.isConnected) continue;
      let found = false;
      for (const sel of NS.selectors.timedtextLineSelectors) {
        const els = container.querySelectorAll(sel);
        if (els.length) {
          els.forEach((el) => parts.push(el.textContent));
          found = true;
          break;
        }
      }
      if (!found) parts.push(container.textContent);
    }
    // Dedupe identical fragments in case two containers briefly render the
    // same cue during a handover.
    return normalize([...new Set(parts.map(normalize).filter(Boolean))].join(' '));
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

  function observeContainer(el) {
    const observer = new MutationObserver(scheduleProcess);
    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    observed.set(el, observer);
    NS.debugLog('observing timedtext container', el, `(${observed.size} total)`);
    scheduleProcess(); // pick up any cue already on screen
  }

  function unobserveAll() {
    for (const observer of observed.values()) observer.disconnect();
    observed.clear();
  }

  // Reconcile the observed set with what's currently in the DOM: prune
  // disconnected containers, attach to any new ones.
  function checkContainers() {
    if (!running) return;

    let changed = false;
    for (const [el, observer] of observed) {
      if (!el.isConnected) {
        observer.disconnect();
        observed.delete(el);
        changed = true;
        NS.debugLog('container left the DOM — pruned');
      }
    }
    for (const el of NS.selectors.findAllTimedtextContainers()) {
      if (!observed.has(el)) {
        observeContainer(el);
        changed = true;
      }
    }
    // If the active container vanished (e.g. mid-transition), re-evaluate so
    // a lingering overlay gets a proper cue-end instead of freezing.
    if (changed) scheduleProcess();
  }

  NS.cueWatcher = {
    start() {
      if (running) return;
      running = true;
      lastCueText = '';

      coarseObserver = new MutationObserver(() => checkContainers());
      coarseObserver.observe(document.body, { childList: true, subtree: true });
      // Interval backstop in case a mutation burst is missed.
      searchTimer = setInterval(checkContainers, C.CONTAINER_SEARCH_INTERVAL_MS);
      checkContainers();
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
      unobserveAll();
      lastCueText = '';
      lastStyle = null;
    },

    handleNavigation() {
      if (!running) return;
      NS.debugLog('SPA navigation — resetting');
      unobserveAll();
      lastCueText = '';
      lastStyle = null;
      NS.styleEngine.reset();
      NS.overlayRenderer.clearAll();
      checkContainers();
    },
  };
})();
