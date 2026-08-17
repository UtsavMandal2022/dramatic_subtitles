# 🎬 Dramatic Subtitles

**Turns Netflix subtitles into Instagram-Reels-style dramatic captions — live, while you watch.**

Big subtitle blocks hide the scene. Dramatic Subtitles scatters the words around the frame instead — so you watch the movie *and* the captions at the same time, with a different look for every line.

> A Chrome extension (Manifest V3), built entirely in vanilla JS/CSS — no bundler, no backend, no tracking, no network calls at runtime.

<!-- TODO: drop your demo GIF/clip here before posting -->
<!-- ![demo](docs/demo.gif) -->

## What it does

Netflix renders subtitles into a plain DOM element. Dramatic Subtitles hides that native caption box completely and re-renders every line itself — with **randomized styling per cue**: font, size, color, screen position, orientation, and entrance/exit animation. No two consecutive lines ever look the same.

### 🎯 Scatter mode — the whole point

Short punchy lines ("Let me go.") don't render as one block. Instead, each word gets its own zone on screen and appears one after another:

```
   LET                              GO
              (center, a beat later)
                        ME
```

Small words spread across the frame occlude almost nothing — you keep watching the actors while the drama plays out around them. This is the core design principle behind everything: **judge every effect by how much of the scene it hides, not just how cool it looks.**

### 🎭 Emotion-aware styling

The engine reads each line's shape and punctuation and picks a mood:

| Cue looks like | Treatment |
|---|---|
| `THIS IS INSANE!` | Bold impact font, red/yellow, shake, forced caps, pop/glitch |
| `...I don't know` | Soft serif, lowercase, muted grey, slow fade |
| `♪ some lyrics ♪` | Handwriting font, purple/pink, gentle float |
| `[door slams]` | Typewriter font, small, letterspaced, glitchy |
| `Where did she go?` | Cyan, slide/pop |
| everything else | Fully random across the whole style pool |

### 🎨 Three render modes, chosen per line

- **Line** — one placement, one animation, the whole sentence
- **Karaoke** — words cascade in one after another, in place
- **Scatter** — words explode across distinct screen zones *(the flagship — see above)*

### 🖋️ Fonts

Five bundled, license-clean display fonts (Anton, Bangers, Permanent Marker, Playfair Display, Special Elite — all SIL Open Font License) plus a pool of safe system stacks, so nothing ever needs to hit the network to render.

### Everything else

- Fully hides Netflix's native caption box (CSS-only, toggle-friendly, survives Netflix re-rendering it)
- Timed off Netflix's own subtitle DOM changes — first word appears exactly when Netflix's would
- Overlay animations pause when you pause the video, resume mid-frame on play
- Survives fullscreen, SPA navigation between titles, and next-episode autoplay
- One on/off toggle in the popup — nothing else to configure

## Install (unpacked, for now)

1. Clone this repo.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked**, select the cloned folder.
5. Open Netflix, turn on subtitles/CC, hit play. Toggle the extension from its popup icon.

## Project layout

```
dramatic_subtitles/
├── manifest.json
├── popup/                  on/off toggle UI
├── src/
│   ├── shared/              storage + config, shared by popup & content script
│   └── content/
│       ├── netflix-selectors.js    ← the ONLY file with Netflix DOM knowledge
│       ├── cue-watcher.js          detects subtitle start/end via MutationObserver
│       ├── style-engine.js         the randomization + emotion-detection engine
│       ├── overlay-renderer.js     builds/animates the overlay DOM
│       ├── native-caption-hider.js hides Netflix's own captions
│       └── content.js              wiring/entry point
├── styles/                  overlay layout, keyframe animations, caption-hiding CSS
└── fonts/                   bundled OFL display fonts
```

## How it actually works (short version)

Netflix writes each subtitle line into a DOM container (historically classed `.player-timedtext`). A `MutationObserver` watches that container, diffs its text against the last-seen cue, and fires a start/end event the moment Netflix's own timing would. Native captions are hidden with `visibility: hidden` gated behind a CSS class, so toggling the extension off instantly restores them — no DOM surgery either way.

Since Netflix doesn't publish this markup as a public API, all of that DOM knowledge is deliberately isolated to one file — [`netflix-selectors.js`](src/content/netflix-selectors.js) — so if Netflix ever changes it, there's exactly one place to patch.

## Known limitations

- Timing is DOM-presence-based, not read from Netflix's internal player clock — accurate in practice, but can drift slightly on seek/pause/buffering.
- Netflix's markup isn't public and can change; if captions stop being detected, see `netflix-selectors.js`.
- This is an **unofficial, personal fan project** — not affiliated with, endorsed by, or built using any private Netflix API. It only reads and restyles the same publicly-visible subtitle text Netflix already shows you in your own browser.

## Roadmap ideas

- Bundled per-word karaoke highlighting synced to precise cue timing (would need a page-context bridge into Netflix's player API)
- User-tunable style intensity in the popup
- Firefox port

## License

MIT — see [LICENSE](LICENSE). Bundled fonts are SIL Open Font License 1.1 (see [`fonts/FONTS.md`](fonts/FONTS.md)).
