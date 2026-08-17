// Shared namespace + config. Loaded first (see manifest.json content_scripts.js order).
window.__dramaticSubs = window.__dramaticSubs || {};

window.__dramaticSubs.constants = {
  STORAGE_KEY_ENABLED: 'dramaticSubsEnabled',
  DEFAULT_ENABLED: true,

  // Class toggled on <html> — gates the caption-hiding CSS rule
  // (see styles/hide-native-captions.css).
  ACTIVE_HTML_CLASS: 'dramatic-subs-active',

  OVERLAY_ROOT_ID: 'dramatic-subs-overlay-root',

  // Set true to get console diagnostics (selector misses, cue events).
  DEBUG: false,

  // Cue-watcher tuning
  CONTAINER_SEARCH_INTERVAL_MS: 500,
  URL_POLL_INTERVAL_MS: 800,

  // Style-engine tuning
  KARAOKE_MIN_WORDS: 2,
  KARAOKE_MAX_WORDS: 10,
  // Per-word entrance stagger, smart-scaled: short lines cascade at the full
  // luxurious delay, longer lines compress so the LAST word always lands
  // within the cascade budget — drama without lagging behind the dialogue.
  KARAOKE_WORD_DELAY_MIN_MS: 170,
  KARAOKE_WORD_DELAY_MAX_MS: 280,
  KARAOKE_MAX_CASCADE_MS: 1000,
  // Scatter mode: each word lands in a different screen zone, one after
  // another. Only short lines stay readable scattered.
  SCATTER_MIN_WORDS: 2,
  SCATTER_MAX_WORDS: 6,
  SCATTER_CHANCE: 0.8,
  VERTICAL_MAX_CHARS: 40,
  VERTICAL_WEIGHT: 0.22,
  FONT_SIZE_MIN_PX: 18,
  FONT_SIZE_MAX_PX: 96,
  // Occlusion principle: big fonts are only allowed when the text is
  // scattered (small words spread out block little). Whole-line and karaoke
  // cues get capped, tighter still when they land dead-center.
  FONT_SIZE_MAX_LINE_PX: 58,
  FONT_SIZE_MAX_CENTER_PX: 48,
  // Occlusion principle: single-block lines rarely land dead-center (that's
  // where the action is) — center is reserved for short punchy words.
  // Scattered words still use all zones.
  CENTER_ZONE_CHANCE: 0.12,
  CENTER_MAX_CHARS: 14,
  // EXPERIMENTAL: render bigger non-scattered lines slightly translucent so
  // the scene ghosts through the letters. Set to false to turn off.
  EXPERIMENTAL_TRANSLUCENT_BIG_LINES: true,
  TRANSLUCENT_SIZE_THRESHOLD_PX: 44,
  TRANSLUCENT_OPACITY: 0.88,
  // Font size as a fraction of player width, randomized in this range.
  SIZE_RANGE_FRACTION: { min: 0.028, max: 0.058 },
};

window.__dramaticSubs.debugLog = function (...args) {
  if (window.__dramaticSubs.constants.DEBUG) {
    console.log('[DramaticSubs]', ...args);
  }
};
