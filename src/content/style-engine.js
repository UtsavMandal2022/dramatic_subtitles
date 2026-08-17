// Picks a random visual style per subtitle line: font, size, position,
// orientation, animation — now emotion-aware (v2): the line's punctuation and
// shape bias every axis, and some lines render karaoke-style (per-word).
// Guarantees consecutive lines never share both position and animation.
(function () {
  const NS = window.__dramaticSubs;
  const C = NS.constants;

  // Bundled OFL fonts (fonts/FONTS.md) first, system stacks as spice/fallback.
  const FONTS = {
    anton: '"DS Anton", "Arial Black", Impact, sans-serif',
    bangers: '"DS Bangers", "Comic Sans MS", cursive',
    marker: '"DS Permanent Marker", "Brush Script MT", cursive',
    playfair: '"DS Playfair Display", Georgia, serif',
    typewriter: '"DS Special Elite", "Courier New", monospace',
    impact: 'Impact, "Arial Narrow", sans-serif',
    trebuchet: '"Trebuchet MS", sans-serif',
    verdana: 'Verdana, sans-serif',
  };

  // Percent offsets are relative to the overlay root (= player area).
  // Bottom row sits at 68% to stay clear of Netflix's control bar.
  const POSITION_ZONES = [
    { name: 'top-left', top: 10, left: 8, verticalOk: false },
    { name: 'top-center', top: 10, left: 50, centerX: true, verticalOk: false },
    { name: 'top-right', top: 10, right: 8, verticalOk: false },
    { name: 'mid-left', top: 42, left: 8, verticalOk: true },
    { name: 'center', top: 42, left: 50, centerX: true, verticalOk: true },
    { name: 'mid-right', top: 42, right: 8, verticalOk: true },
    // Bottom row anchors by the BOTTOM edge, not top — text sits genuinely
    // low and grows upward, so the lower quarter of the frame actually gets
    // used without any risk of spilling off-screen.
    { name: 'bottom-left', bottom: 8, left: 8, verticalOk: true },
    { name: 'bottom-center', bottom: 8, left: 50, centerX: true, verticalOk: true },
    { name: 'bottom-right', bottom: 8, right: 8, verticalOk: true },
  ];

  // Class names defined in styles/animations.css. Enter/exit are matched
  // pairs so the exit always visually corresponds to the entrance.
  const ANIMATIONS = {
    pop: { name: 'pop', enterClass: 'anim-enter-pop', exitClass: 'anim-exit-pop' },
    slide: { name: 'slide', enterClass: 'anim-enter-slide', exitClass: 'anim-exit-slide' },
    bounce: { name: 'bounce', enterClass: 'anim-enter-bounce', exitClass: 'anim-exit-bounce' },
    glitch: { name: 'glitch', enterClass: 'anim-enter-glitch', exitClass: 'anim-exit-glitch' },
    fade: { name: 'fade', enterClass: 'anim-enter-fade', exitClass: 'anim-exit-fade' },
  };
  const ALL_ANIMS = Object.values(ANIMATIONS);

  // Per-emotion styling profiles. Each field narrows or reweights a pool;
  // anything omitted falls back to the neutral defaults.
  const EMOTIONS = {
    intense: {
      fonts: [FONTS.anton, FONTS.bangers, FONTS.impact],
      colors: ['#ff3131', '#ffe600', '#ffffff'],
      anims: [ANIMATIONS.pop, ANIMATIONS.glitch, ANIMATIONS.bounce],
      sizeMultiplier: 1.35,
      uppercase: 1.0,
      holdClass: 'ds-hold-shake',
      karaokeChance: 0.6,
      scatterChance: 0.85,
    },
    whisper: {
      fonts: [FONTS.playfair, FONTS.marker],
      colors: ['#cfd8dc', '#b0bec5', '#ffffff'],
      anims: [ANIMATIONS.fade],
      sizeMultiplier: 0.72,
      uppercase: 0,
      lowercase: true,
      opacity: 0.85,
      karaokeChance: 0,
      scatterChance: 0,
    },
    music: {
      fonts: [FONTS.marker, FONTS.bangers],
      colors: ['#b388ff', '#7df9ff', '#ff9ff3'],
      anims: [ANIMATIONS.fade, ANIMATIONS.slide],
      sizeMultiplier: 1.0,
      uppercase: 0.1,
      holdClass: 'ds-hold-float',
      karaokeChance: 0.5,
    },
    sfx: {
      fonts: [FONTS.typewriter],
      colors: ['#e0e0e0', '#9e9e9e'],
      anims: [ANIMATIONS.glitch, ANIMATIONS.fade],
      sizeMultiplier: 0.68,
      uppercase: 1.0,
      letterSpacing: true,
      karaokeChance: 0,
      scatterChance: 0,
    },
    curious: {
      fonts: [FONTS.trebuchet, FONTS.playfair, FONTS.marker],
      colors: ['#7df9ff', '#ffe600', '#ffffff'],
      anims: [ANIMATIONS.slide, ANIMATIONS.pop],
      sizeMultiplier: 1.05,
      uppercase: 0.25,
      karaokeChance: 0.35,
    },
    neutral: {
      fonts: Object.values(FONTS),
      colors: ['#ffffff', '#ffe600', '#ff4d6d', '#7df9ff', '#b6ff5c'],
      anims: ALL_ANIMS,
      sizeMultiplier: 1.0,
      uppercase: 0.45,
      karaokeChance: 0.35,
    },
  };

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rand = (min, max) => min + Math.random() * (max - min);

  let lastStyle = null;

  function detectEmotion(text) {
    // Sound cues like [door slams] / (gunshot) — typewriter sfx treatment.
    if (/^[\[(].*[\])]$/.test(text)) return 'sfx';
    // Music lines carry note glyphs.
    if (/[♪♫♬]/.test(text)) return 'music';
    // Shouting: exclamation, or the line is basically all caps.
    const letters = text.replace(/[^a-zA-Z]/g, '');
    const isAllCaps = letters.length >= 4 && letters === letters.toUpperCase();
    if (/!/.test(text) || isAllCaps) return 'intense';
    // Trailing off / hesitation.
    if (/(\.\.\.|…)/.test(text)) return 'whisper';
    if (/\?/.test(text)) return 'curious';
    return 'neutral';
  }

  // Occlusion principle: whole-line cues avoid the center zone (where the
  // action usually is) — center only fires occasionally, and only for short
  // punchy lines. Scatter mode bypasses this and uses the full grid.
  function pickPosition(vertical, cueText) {
    const pool = vertical
      ? POSITION_ZONES.filter((z) => z.verticalOk)
      : POSITION_ZONES;
    const center = pool.find((z) => z.name === 'center');
    if (
      center &&
      cueText.length <= C.CENTER_MAX_CHARS &&
      Math.random() < C.CENTER_ZONE_CHANCE
    ) {
      return center;
    }
    return pick(pool.filter((z) => z.name !== 'center'));
  }

  NS.styleEngine = {
    pickStyle(cueText, playerWidthPx) {
      const emotionName = detectEmotion(cueText);
      const emo = EMOTIONS[emotionName];

      const canBeVertical = cueText.length <= C.VERTICAL_MAX_CHARS;
      const vertical =
        canBeVertical && emotionName === 'neutral' && Math.random() < C.VERTICAL_WEIGHT;

      const width = playerWidthPx || window.innerWidth;
      const fraction = rand(C.SIZE_RANGE_FRACTION.min, C.SIZE_RANGE_FRACTION.max);
      const fontSizePx = Math.round(
        Math.min(
          C.FONT_SIZE_MAX_PX,
          Math.max(C.FONT_SIZE_MIN_PX, width * fraction * emo.sizeMultiplier)
        )
      );

      let position = pickPosition(vertical, cueText);
      let animation = pick(emo.anims);

      // "Never the same twice in a row": re-roll the two most visually
      // repetitive axes if both match the previous line (max 3 attempts —
      // then accept, to avoid loops on tiny pools).
      if (lastStyle) {
        for (
          let i = 0;
          i < 3 &&
          position.name === lastStyle.position.name &&
          animation.name === lastStyle.animation.name;
          i++
        ) {
          position = pickPosition(vertical, cueText);
          animation = pick(emo.anims);
        }
      }

      // Word-level modes, only for horizontal lines. Scatter (each word in a
      // different screen zone) wins the roll over karaoke (words cascading
      // in place); both are off for whisper/sfx via their profiles.
      const wordCount = cueText.split(/\s+/).length;
      const scatter =
        !vertical &&
        wordCount >= C.SCATTER_MIN_WORDS &&
        wordCount <= C.SCATTER_MAX_WORDS &&
        Math.random() < (emo.scatterChance ?? C.SCATTER_CHANCE);
      const karaoke =
        !scatter &&
        !vertical &&
        wordCount >= C.KARAOKE_MIN_WORDS &&
        wordCount <= C.KARAOKE_MAX_WORDS &&
        Math.random() < emo.karaokeChance;

      // Distinct zone per word: shuffle the grid, take one zone each.
      let scatterZones = null;
      if (scatter) {
        const shuffled = [...POSITION_ZONES];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        scatterZones = shuffled.slice(0, wordCount);
      }

      // Occlusion principle: only scattered text may use the full size range;
      // single-block lines get capped (hardest in the center zone), and big
      // ones go slightly translucent (experimental) so the scene shows
      // through.
      let finalFontSizePx = fontSizePx;
      let opacity = emo.opacity ?? 1;
      if (!scatter) {
        const cap =
          position.name === 'center'
            ? C.FONT_SIZE_MAX_CENTER_PX
            : C.FONT_SIZE_MAX_LINE_PX;
        finalFontSizePx = Math.min(finalFontSizePx, cap);
        if (
          C.EXPERIMENTAL_TRANSLUCENT_BIG_LINES &&
          finalFontSizePx >= C.TRANSLUCENT_SIZE_THRESHOLD_PX
        ) {
          opacity = Math.min(opacity, C.TRANSLUCENT_OPACITY);
        }
      }

      const style = {
        emotion: emotionName,
        font: pick(emo.fonts),
        color: pick(emo.colors),
        fontSizePx: finalFontSizePx,
        vertical,
        position,
        animation,
        uppercase: Math.random() < emo.uppercase,
        lowercase: !!emo.lowercase,
        opacity,
        letterSpacingEm:
          emo.letterSpacing || Math.random() < 0.3 ? rand(0.05, 0.2) : 0,
        holdClass: emo.holdClass || null,
        karaoke,
        scatter,
        scatterZones,
        // The last word appears at (wordCount - 1) * delay, so dividing the
        // budget by (wordCount - 1) makes total cascade time constant for
        // long lines while short lines keep the full random delay.
        wordDelayMs:
          karaoke || scatter
            ? Math.round(
                Math.min(
                  rand(C.KARAOKE_WORD_DELAY_MIN_MS, C.KARAOKE_WORD_DELAY_MAX_MS),
                  C.KARAOKE_MAX_CASCADE_MS / Math.max(1, wordCount - 1)
                )
              )
            : 0,
      };
      lastStyle = style;
      NS.debugLog(
        'style:',
        emotionName,
        style.scatter ? 'scatter' : style.karaoke ? 'karaoke' : 'line',
        style
      );
      return style;
    },

    reset() {
      lastStyle = null;
    },
  };
})();
