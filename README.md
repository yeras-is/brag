# /brag

**You built it. Now brag.**

> **Want a video without running `/brag` yourself?** Paste your site's link at [letsbrag.app](https://letsbrag.app).

[![the /brag launch site — you built it, now brag](docs/assets/hero.png)](https://latent-spaces.github.io/brag/)

`/brag` is an agent skill natively tuned for **Gemini** in **Google Antigravity** and **Gemini CLI** (and compatible with any Agent Skills host) that turns your project directory or live website URL into a short, shareable launch video — beat-synced music, Kenney sound effects, motion, multimodal visual QA, frame-0 poster thumbnail, and share copy included.

---

## Architecture: Self-Contained HTML/CSS/JS + Headless Browser + FFmpeg + Multimodal Visual QA

By default, `/brag` runs a fast, zero-external-SaaS pipeline right on your machine:

1. **Inspect (`Step 1`):** Reads your project's actual HTML/CSS/components (or live URL) to extract exact brand colors, typography, verbatim claims, and the 2–3 beat working product flow (`entry → key action → result`).
2. **Plan & Beat-Sync (`Step 2`):** Writes `<output-dir>/brag-plan.md` with strict pacing math (`15–25s` runtime, `18–22s` sweet spot, max `6–8` words per scene, `>=0.3s/word` settled hold with `~1.2s` headline floor) and locks key transitions to precomputed beat/cue presets in `skills/brag/assets/music/cues/`.
3. **Deterministic HTML/CSS/JS Composition (`Step 3`):** Builds `<output-dir>/composition/index.html` implementing `window.seekTo(t)` so every frame is a pure function of time `t`, paired with `audio-mix.json` referencing bundled CC-BY music and CC0 Kenney SFX (`skills/brag/assets/`). *(Pass `--hyperframes` if you prefer to hand off to the Hyperframes CLI instead.)*
4. **Mandatory Multimodal Visual QA Gate (`Step 4a–4b`):** `skills/brag/scripts/render_composition.mjs --qa` drives headless Chrome/Chromium via Chrome DevTools Protocol (CDP) to render keyframe PNGs at **15%, 40%, 65%, and 90%** of the timeline (plus the poster candidate). Gemini inspects all rendered PNGs with its native vision tool to verify zero text clipping/overflow, WCAG AA contrast, and scene variety before encoding video.
5. **Render & Frame-0 Poster Bake (`Step 4c`):** `render_composition.mjs --render` captures 30fps frames, mixes the music bed and timed SFX via FFmpeg, extracts `<output-dir>/brag.jpg`, bakes it into **frame 0** of `<output-dir>/brag.mp4`, and writes `<output-dir>/share-copy.txt`.

---

## Install `/brag`

### Google Antigravity & Gemini CLI (Recommended)

This repository includes materialized skill directories at `.agents/skills/brag/` (no fragile symlinks required) and a sync script to install globally into `~/.gemini/config/skills/` and `~/.agents/skills/`:

```bash
# Install globally for Google Antigravity and Gemini CLI
node scripts/sync-skills.mjs --global

# Or install into any project via the skills CLI
npx skills add https://github.com/yeras-is/brag --skill brag
```

To copy directly without running the script:

```bash
rsync -a --exclude '.DS_Store' skills/brag/ ~/.gemini/config/skills/brag/
```

### Other Agent Hosts (Codex, Claude Code, opencode, Cursor)

| Agent | Discovery Path / Install Command |
|---|---|
| **Google Antigravity** | Auto-detects `.agents/skills/brag/` at project root or `~/.gemini/config/skills/brag/` globally (`node scripts/sync-skills.mjs --global`) |
| **Gemini CLI** | Auto-detects `.agents/skills/brag/` or `~/.gemini/config/skills/brag/` |
| **Universal `skills` CLI** | `npx skills add https://github.com/yeras-is/brag --skill brag` (`-g` for global) |
| **Codex CLI** | Auto-detects `.agents/skills/brag/` or via `codex plugin marketplace add yeras-is/brag && codex plugin add brag@brag` |
| **Claude Code** | Auto-detects `.claude/skills/brag/` or via `/plugin marketplace add yeras-is/brag && /plugin install brag@brag` |
| **opencode** | Auto-detects `.opencode/skills/brag/` at project root |
| **Other agents** | See [`docs/other-agents.md`](docs/other-agents.md) |

> Need a single-file, zero-bundled-asset variant? `skills/brag-slim/` (`/brag-slim`) ships alongside `/brag` and follows the exact same creative laws, pacing math, and 4-keyframe visual QA gate.

---

## Usage & Flags

From any project directory, ask Gemini in Antigravity or your CLI agent:

```text
let's /brag
```

Or pass flags / natural language direction:

```text
/brag --tone yc-parody
/brag --tone "fake Series A launch from 2016" --format vertical
/brag --no-music --no-sfx
/brag --voice
/brag --hyperframes
```

| Flag | Values | Default |
|---|---|---|
| `--tone` | `default`, `polished`, `yc-parody`, `chaotic`, `deadpan`, `cinematic`, `app-store`, or freeform | inferred |
| `--format` | `landscape` (`1920x1080`), `vertical` (`1080x1920`), `square` (`1080x1080`) | `landscape` (`30fps`) |
| `--duration` | `15–25` seconds | auto (`18–22s` sweet spot) |
| `--no-music` | boolean flag | music on (bundled tracks in `skills/brag/assets/music/`) |
| `--no-sfx` | boolean flag | SFX on (bundled Kenney SFX in `skills/brag/assets/sfx/`) |
| `--voice` | boolean flag | narration off (opt-in only; ducks music bed to `0.12–0.15`) |
| `--title` | string | inferred from project |
| `--hyperframes` | boolean flag | off (uses self-contained HTML/CSS/JS + headless browser + FFmpeg pipeline; pass `--hyperframes` to hand off to Hyperframes CLI) |

You get a `brag-output/` folder containing:
- `brag.mp4` — 30fps H.264/AAC launch video with the poster baked into frame 0
- `brag.jpg` — high-resolution settled poster frame
- `brag-plan.md` — rubric answers, beat-sync cues, and storyboard math
- `share-copy.txt` — ready-to-post launch caption
- `composition/` — deterministic HTML/CSS/JS composition and `audio-mix.json`
- `work/qa/` — visually audited 15%, 40%, 65%, and 90% keyframe PNGs + `qa-report.json`

---

## Requirements

- **Node.js 22+** (uses built-in `WebSocket` and `fetch` to drive Chrome DevTools Protocol with zero npm dependencies)
- **Google Chrome or Chromium** installed locally (or in Puppeteer/Playwright cache)
- **FFmpeg** (`ffmpeg` and `ffprobe`) on `PATH`
- *(Optional)* **Python 3.11+ & `librosa`** only if running `skills/brag/scripts/analyze_music_cues.py` on custom non-bundled audio tracks
- *(Optional)* **Hyperframes CLI** (`npx hyperframes`) only when passing `--hyperframes`

---

## Repository Structure

- `skills/brag/` — primary `/brag` skill, `scripts/render_composition.mjs`, `references/`, and bundled music + SFX (`assets/`)
- `skills/brag-slim/` — single-file zero-asset sibling skill
- `.agents/skills/` — materialized skill directories for Google Antigravity, Gemini CLI, and Codex discovery (synced via `node scripts/sync-skills.mjs`)
- `scripts/sync-skills.mjs` — materializes and validates all skill discovery paths (`--global` to install to `~/.gemini/config/skills/`, `--check` to verify)
- `examples/` — sample product sites used for testing and benchmarking
- `docs/` — launch site (GitHub Pages)

---

## Credits

- Music — [ende.app](https://ende.app/en) "Happy Beats / Business Moves" (CC BY 4.0)
- Sound effects — [Kenney](https://kenney.nl/) & OpenGameArt (CC0)
- Demo sites — built with [Impeccable](https://impeccable.style/)
