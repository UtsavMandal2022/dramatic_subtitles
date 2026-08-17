// Owns the overlay DOM: one persistent root inside the player area, and at
// most one live cue element at a time.
//
// Cue structure (v2):
//   <div class="dramatic-subs-cue [anim-enter-*]">   position + enter/exit
//     <div class="ds-inner [ds-hold-*]">             continuous shake/float
//       text  |  <span class="ds-word">…             karaoke word spans
(function () {
  const NS = window.__dramaticSubs;
  const C = NS.constants;

  const WARMUP_FAMILIES = [
    'DS Anton',
    'DS Bangers',
    'DS Permanent Marker',
    'DS Playfair Display',
    'DS Special Elite',
  ];

  let root = null;
  let currentCue = null;
  let exiting = false;
  let fontsWarmed = false;

  function ensureRoot() {
    if (!root || !root.isConnected) {
      root = document.getElementById(C.OVERLAY_ROOT_ID);
      if (!root) {
        root = document.createElement('div');
        root.id = C.OVERLAY_ROOT_ID;
      }
    }
    // The root lives as a direct child of document.body (position:fixed =
    // viewport = the player area on a watch page), hopping into the
    // fullscreen element only while fullscreen is active — a fixed-position
    // descendant there still resolves against the viewport, but it must be
    // INSIDE the fullscreened subtree to render at all. Never parent into
    // Netflix's own player containers: their box geometry isn't ours to rely
    // on, and percentage zones compress into whatever box they happen to
    // have. On fullscreen exit, return to the direct body child (a bare
    // contains() check would leave the root stranded inside Netflix's
    // player element, whose ancestors we don't control).
    const fs = document.fullscreenElement;
    if (fs) {
      if (!fs.contains(root)) fs.appendChild(root);
    } else if (root.parentElement !== document.body) {
      document.body.appendChild(root);
    }
    return root;
  }

  // Kick off .woff2 loads before the first cue so the first dramatic line
  // doesn't render in a fallback font mid-animation.
  function warmupFonts() {
    if (fontsWarmed || !document.fonts) return;
    fontsWarmed = true;
    for (const family of WARMUP_FAMILIES) {
      document.fonts.load(`700 24px "${family}"`).catch(() => {});
    }
  }

  function removeCurrent() {
    if (currentCue) {
      currentCue.remove();
      currentCue = null;
      exiting = false;
    }
  }

  // Post-insertion safety clamp: shrink font / pull back inside the player
  // bounds if the rendered box clips (mainly long vertical lines, or
  // multi-line wraps of long bottom-zone cues).
  //
  // Measured with offset* geometry (layout box), NOT getBoundingClientRect —
  // the entrance animation's keyframe transform (e.g. pop-in's scale(0.3) at
  // 0%) is still in flight the instant we insert the element, so a
  // rect-based measurement here can catch it mid-animation and read a
  // smaller-than-final size, letting an overflow slip through undetected.
  // offset* ignores transforms entirely, so it always reflects the settled
  // (untransformed) box regardless of animation timing.
  function clampIntoBounds(el, container) {
    const boundsH = container.clientHeight;
    const boundsW = container.clientWidth;

    for (
      let i = 0;
      i < 4 && (el.offsetHeight > boundsH * 0.9 || el.offsetWidth > boundsW * 0.9);
      i++
    ) {
      const size = parseFloat(el.style.fontSize);
      el.style.fontSize = Math.max(C.FONT_SIZE_MIN_PX, size * 0.8) + 'px';
    }

    // Bottom-anchored cues (style.bottom set) grow upward and can't overflow
    // the bottom edge, so the pull-up correction only applies to top-anchored
    // ones. If anything pokes past the TOP edge (tall vertical text), re-pin
    // to the top — clearing `bottom` first, since an element with both top
    // and bottom set stretches instead of moving.
    const bottom = el.offsetTop + el.offsetHeight;
    if (el.style.top && bottom > boundsH) {
      el.style.top = `calc(${el.style.top} - ${bottom - boundsH + 8}px)`;
    }
    if (el.offsetTop < 0) {
      el.style.bottom = 'auto';
      el.style.top = '5%';
    }
  }

  // Layout box of a scatter word using offset* metrics — NOT
  // getBoundingClientRect, which would reflect the entrance animation's 0%
  // keyframe transform (words waiting on their stagger delay sit off-screen).
  // The translateX(-50%) centering isn't part of layout, so apply it manually.
  function wordBox(w) {
    let left = w.offsetLeft;
    const width = w.offsetWidth;
    if ((w.style.getPropertyValue('--ds-base-transform') || '').includes('-50%')) {
      left -= width / 2;
    }
    return { left, top: w.offsetTop, right: left + width, bottom: w.offsetTop + w.offsetHeight };
  }

  function intersects(a, b, gap) {
    return (
      a.left < b.right + gap &&
      b.left < a.right + gap &&
      a.top < b.bottom + gap &&
      b.top < a.bottom + gap
    );
  }

  // Big words can spill out of their grid zone into a neighbor's. Greedy
  // pass: for each word, against all earlier ones — shrink it a bit first,
  // then relocate it below (or above) the word it collides with.
  function resolveScatterCollisions(el) {
    if (!el.isConnected) return;
    const MIN_GAP = 8;
    const words = Array.from(el.querySelectorAll('.ds-scatter-word'));
    for (let i = 1; i < words.length; i++) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const box = wordBox(words[i]);
        const hit = words
          .slice(0, i)
          .map(wordBox)
          .find((b) => intersects(box, b, MIN_GAP));
        if (!hit) break;
        if (attempt < 2) {
          const size = parseFloat(words[i].style.fontSize || getComputedStyle(words[i]).fontSize);
          words[i].style.fontSize = Math.max(C.FONT_SIZE_MIN_PX, size * 0.82) + 'px';
        } else {
          const height = box.bottom - box.top;
          let newTop = hit.bottom + MIN_GAP;
          if (newTop + height > el.clientHeight) {
            newTop = Math.max(0, hit.top - height - MIN_GAP);
          }
          // Clear any bottom anchor — top+bottom together would stretch the
          // element instead of relocating it.
          words[i].style.bottom = 'auto';
          words[i].style.top = newTop + 'px';
        }
      }
    }
  }

  function buildInner(text, style) {
    const inner = document.createElement('div');
    inner.className = 'ds-inner';
    if (style.holdClass) inner.classList.add(style.holdClass);

    if (!style.karaoke) {
      inner.textContent = text;
      return inner;
    }

    // Karaoke: one span per word, entrance staggered via animation-delay.
    const words = text.split(/\s+/);
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'ds-word ' + style.animation.enterClass;
      span.textContent = i < words.length - 1 ? word + ' ' : word;
      span.style.animationDelay = i * style.wordDelayMs + 'ms';
      inner.appendChild(span);
    });
    return inner;
  }

  NS.overlayRenderer = {
    init() {
      ensureRoot();
      warmupFonts();
    },

    reparent() {
      ensureRoot();
    },

    setPaused(paused) {
      ensureRoot().classList.toggle('ds-paused', paused);
    },

    showCue(text, style) {
      const container = ensureRoot();
      // One line at a time: kill any previous cue (even mid-exit) instantly.
      removeCurrent();

      const el = document.createElement('div');
      el.className = 'dramatic-subs-cue';
      // In karaoke/scatter mode the words animate themselves in; the outer
      // element enters statically (its exit still applies on hide).
      if (!style.karaoke && !style.scatter) {
        el.classList.add(style.animation.enterClass);
      }

      el.style.fontFamily = style.font;
      el.style.color = style.color;
      el.style.fontSize = style.fontSizePx + 'px';
      if (style.opacity < 1) el.style.opacity = style.opacity;

      if (style.scatter) {
        // Scatter: the cue covers the whole player; each word is its own
        // absolutely-positioned element in its own zone.
        el.classList.add('dramatic-subs-scatter');
        const words = text.split(/\s+/);
        words.forEach((word, i) => {
          const zone = style.scatterZones[i % style.scatterZones.length];
          const w = document.createElement('div');
          w.className = 'ds-scatter-word ' + style.animation.enterClass;
          if (zone.top != null) w.style.top = zone.top + '%';
          if (zone.bottom != null) w.style.bottom = zone.bottom + '%';
          if (zone.left != null) w.style.left = zone.left + '%';
          if (zone.right != null) w.style.right = zone.right + '%';
          if (zone.centerX) {
            w.style.setProperty('--ds-base-transform', 'translateX(-50%)');
          }
          w.style.animationDelay = i * style.wordDelayMs + 'ms';
          const inner = document.createElement('span');
          inner.className = 'ds-inner';
          if (style.holdClass) inner.classList.add(style.holdClass);
          inner.textContent = word;
          w.appendChild(inner);
          el.appendChild(w);
        });
        // Words are in the DOM (layout resolved) even while awaiting their
        // stagger delay, so collisions can be fixed before anything shows.
        requestAnimationFrame(() => resolveScatterCollisions(el));
      } else {
        if (style.position.top != null) el.style.top = style.position.top + '%';
        if (style.position.bottom != null) el.style.bottom = style.position.bottom + '%';
        if (style.position.left != null) el.style.left = style.position.left + '%';
        if (style.position.right != null) el.style.right = style.position.right + '%';
        if (style.position.centerX) {
          el.style.setProperty('--ds-base-transform', 'translateX(-50%)');
        }
        if (style.vertical) el.classList.add('dramatic-subs-vertical');
        el.appendChild(buildInner(text, style));
      }

      if (style.uppercase) el.style.textTransform = 'uppercase';
      else if (style.lowercase) el.style.textTransform = 'lowercase';
      if (style.letterSpacingEm) el.style.letterSpacing = style.letterSpacingEm + 'em';

      container.appendChild(el);
      currentCue = el;
      exiting = false;

      if (!style.scatter) clampIntoBounds(el, container);
    },

    hideCue(style) {
      if (!currentCue) return;
      if (exiting) {
        // Second hide before the exit finished — just drop it.
        removeCurrent();
        return;
      }
      const el = currentCue;
      exiting = true;
      const cleanup = () => {
        if (currentCue === el) {
          currentCue = null;
          exiting = false;
        }
        el.remove();
      };
      const exitClass = style ? style.animation.exitClass : 'anim-exit-fade';

      const scatterWords = el.querySelectorAll('.ds-scatter-word');
      if (scatterWords.length) {
        // Scatter: every word plays the exit together (clear the entrance
        // stagger), remove once the last one finishes.
        let remaining = scatterWords.length;
        scatterWords.forEach((w) => {
          w.className = w.className.replace(/anim-enter-\S+/, '');
          w.style.animationDelay = '0ms';
          w.classList.add(exitClass);
        });
        el.addEventListener('animationend', (e) => {
          if (
            e.target.classList &&
            e.target.classList.contains('ds-scatter-word') &&
            --remaining <= 0
          ) {
            cleanup();
          }
        });
      } else {
        // Swap enter -> matching exit animation, remove when it ends.
        el.className = el.className.replace(/anim-enter-\S+/, '');
        el.classList.add(exitClass);
        // Only the outer element's own exit animation counts — word-span
        // enter animations bubble animationend up here and must not trigger
        // removal.
        el.addEventListener('animationend', (e) => {
          if (e.target === el) cleanup();
        });
      }
      // Fallback in case animationend never fires (tab hidden, etc.)
      setTimeout(cleanup, 1200);
    },

    clearAll() {
      removeCurrent();
      if (root) root.replaceChildren();
    },

    playerWidth() {
      const container = ensureRoot();
      return container.clientWidth || window.innerWidth;
    },
  };
})();
