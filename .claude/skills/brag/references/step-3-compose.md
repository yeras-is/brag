# Step 3: Build the Composition

By default, `/brag` builds a **self-contained, deterministic HTML/CSS/JS composition** in `<output-dir>/composition/index.html` paired with `<output-dir>/composition/audio-mix.json`, rendered via `<skill-dir>/scripts/render_composition.mjs`.

If the user explicitly passed `--hyperframes`, see **Section 2 (Opt-In `--hyperframes` Workflow)** at the bottom of this file.

---

## 1. Default Workflow: Deterministic HTML/CSS/JS Composition

### 1.1 Copy Required Audio Assets into `<output-dir>/composition/assets/`

Copy the chosen music track and Kenney SFX files from `<skill-dir>/assets/` into `<output-dir>/composition/assets/`:

```bash
mkdir -p <output-dir>/composition/assets/music <output-dir>/composition/assets/sfx
cp <skill-dir>/assets/music/<track>.mp3 <output-dir>/composition/assets/music/
cp <skill-dir>/assets/sfx/<family>/<file> <output-dir>/composition/assets/sfx/
```

### 1.2 Deterministic Timeline Contract (`window.seekTo(t)`)

`<skill-dir>/scripts/render_composition.mjs` drives headless Chrome and calls `await window.seekTo(t)` for each keyframe (in `--qa` mode) and for every `1/30s` frame (in `--render` mode).

Your `<output-dir>/composition/index.html` **must**:
1. Define `window.__BRAG_DURATION = <total_seconds>;` (e.g. `20`).
2. Implement `window.seekTo = function(t) { ... };` where `t` is the elapsed time in seconds (`0 <= t <= window.__BRAG_DURATION`).
3. Compute all scene visibility, entrance progress, staggered card offsets, SVG stroke `stroke-dashoffset`, simulated cursor positions, and continuous subtle camera drift (`scale(1 + 0.025 * p)`) **purely as a function of `t`** — never rely on `setTimeout` or `setInterval` for visual state.
4. Support live browser preview when opened interactively by starting a `requestAnimationFrame` loop only when not controlled by the renderer.

### 1.3 Reference Easing & Timeline Helpers for `composition/index.html`

Use these math helpers inside `<output-dir>/composition/index.html` to get crisp `cubic-bezier(0.22, 1, 0.36, 1)` entrances, staggered sequences (`80–120ms`), and continuous drift:

```javascript
window.__BRAG_DURATION = 20.0;

// Clamped normalized progress in [0, 1] over [start, start + dur]
function progress(t, start, dur) {
  if (dur <= 0) return t >= start ? 1 : 0;
  return Math.max(0, Math.min(1, (t - start) / dur));
}

// Fast-out cubic-bezier(0.22, 1, 0.36, 1) approximation for snappy 0.3–0.6s entrances
function easeOutExpo(x) {
  return x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
}

// Staggered item entrance (staggerSec = 0.08 to 0.12 for 80–120ms)
function staggeredEntrance(t, baseStart, index, staggerSec = 0.10, enterDur = 0.42) {
  const p = progress(t, baseStart + index * staggerSec, enterDur);
  return easeOutCubic(p);
}

// Continuous subtle drift over a scene window [sceneStart, sceneEnd] so no frame is ever static
function sceneDrift(t, sceneStart, sceneEnd) {
  const p = progress(t, sceneStart, sceneEnd - sceneStart);
  return {
    scale: 1 + 0.028 * p,
    translateY: -6 * p,
  };
}
```

### 1.4 Layout & Visual Craft Rules
- **Fixed Viewport Stage:** Style `html, body` with `width: 1920px; height: 1080px; overflow: hidden; margin: 0; position: relative;` (or `1080x1920` / `1080x1080` for vertical/square).
- **Safe Margins:** Keep all readable text and UI cards at least `80px` inside the viewport edges (`padding: 80px 110px`) so nothing ever clips at `15%`, `40%`, `65%`, or `90%`.
- **Real Product First:** Embed the project's actual SVG diagrams, UI cards, interactive forms, and spec tables directly into the scene containers, and animate their real parts (e.g., progressive SVG `stroke-dashoffset`, simulated cursor moving to a button and clicking with a ripple/active state, sequential spec cards sliding into place).
- **Clean Scene Transitions:** Activate only the current scene (`display: flex` or `opacity: 1`) or use a crisp `0.25s` wipe / staggered exit-before-enter so two scenes never overlap their text layers.

### 1.5 Write `<output-dir>/composition/audio-mix.json`

Configure the music bed and beat-aligned SFX cues in `<output-dir>/composition/audio-mix.json` (paths relative to `<output-dir>/composition/`):

```json
{
  "music": {
    "src": "assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3",
    "volume": 0.34,
    "fadeIn": 0.4,
    "fadeOut": 1.4
  },
  "sfx": [
    { "src": "assets/sfx/impactSoft_medium_001.ogg", "time": 0.25, "volume": 0.72 },
    { "src": "assets/sfx/click_002.ogg", "time": 3.80, "volume": 0.68 },
    { "src": "assets/sfx/card-slide-1.ogg", "time": 8.15, "volume": 0.65 },
    { "src": "assets/sfx/impactBell_heavy_000.ogg", "time": 16.40, "volume": 0.75 }
  ]
}
```

---

## 2. Opt-In `--hyperframes` Workflow (Only When `--hyperframes` Flag is Passed)

If and only if the user explicitly passes `--hyperframes`:
1. Write `<output-dir>/composition-brief.md` summarizing the source material, tone, exact palette/fonts, storyboard scenes, and audio files copied into `<output-dir>/composition/assets/`.
2. Load the Hyperframes companion skills (`hyperframes`, `hyperframes-registry`, `media-use`, `hyperframes-cli`) if installed, build the Hyperframes composition in `<output-dir>/composition/`, and run `npx hyperframes check`.
3. Even when `--hyperframes` is used, you **must still complete the Step 4 Multimodal Visual QA Gate** by inspecting rendered keyframe PNGs at 15%, 40%, 65%, and 90% before delivering `brag.mp4`.
