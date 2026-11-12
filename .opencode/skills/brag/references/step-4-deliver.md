# Step 4: Mandatory Multimodal Visual QA Gate, Render & Deliver

Never render or deliver `brag.mp4` blindly. Every run must pass the two-stage verification and delivery pipeline below.

---

## Stage 1: Keyframe PNG Render & Mandatory Gemini Vision QA Gate

### 1.1 Render the 4 Timeline Keyframes (`15%`, `40%`, `65%`, `90%`) + Poster Candidate

Run `<skill-dir>/scripts/render_composition.mjs` with `--qa`:

```bash
node <skill-dir>/scripts/render_composition.mjs \
  --html <output-dir>/composition/index.html \
  --duration <duration_sec> \
  --width <width> --height <height> \
  --poster-time <settled_poster_sec> \
  --qa \
  --out-dir <output-dir>/work/qa
```

This produces 5 PNG images and an automated DOM geometry report in `<output-dir>/work/qa/`:
- `qa-15pct.png` (typically Scene 1 / Hook settled state)
- `qa-40pct.png` (typically Scene 2 / Working Product or Blueprint Reveal)
- `qa-65pct.png` (typically Scene 3 / Interactive UI or Staggered Spec Cards)
- `qa-90pct.png` (typically Final Scene / Outro & CTA)
- `poster-candidate.png` (the frame at `--poster-time` that will become `brag.jpg` and frame 0 of `brag.mp4`)
- `qa-report.json` (DOM bounding-box overflow/clipping audit)

### 1.2 Hard Blocking Gate: Inspect Every PNG with Native Vision

Call your native file/image inspection tool (`read_file` / `view_file`) on `qa-15pct.png`, `qa-40pct.png`, `qa-65pct.png`, `qa-90pct.png`, and `poster-candidate.png`. Check each image against all three criteria:

1. **No Text Overflow, Clipping, or Collisions:**
   - Check that `qa-report.json` reports `"domAuditPassed": true` and `issues: []` on every keyframe.
   - Visually confirm no headline, card border, SVG label, or badge is cut off by the viewport edge or colliding with another element.
2. **High Foreground/Background Contrast:**
   - Confirm all primary headlines, body text, and UI labels have crisp WCAG AA contrast against their immediate background surface and are not caught in a washed-out mid-fade.
3. **Visual Variety & Real Product Presence:**
   - Confirm the 4 keyframes look distinct across the video arc (showing actual product UI, diagrams, simulated interactions, and editorial typography rather than 4 identical text slides).

> **Blocking Rule:** If any keyframe fails any of the 3 checks above, edit `<output-dir>/composition/index.html` to fix the layout, contrast, or timing, re-run `--qa`, and re-inspect the updated PNGs before proceeding to Stage 2.

---

## Stage 2: Final 30fps MP4 Render, Frame-0 Poster Baking & Share Copy

### 2.1 Render `brag.mp4` and `brag.jpg`

Once Stage 1 passes, run `<skill-dir>/scripts/render_composition.mjs` with `--render`:

```bash
node <skill-dir>/scripts/render_composition.mjs \
  --html <output-dir>/composition/index.html \
  --duration <duration_sec> --fps 30 \
  --width <width> --height <height> \
  --poster-time <settled_poster_sec> \
  --audio-config <output-dir>/composition/audio-mix.json \
  --render \
  --out-mp4 <output-dir>/brag.mp4 \
  --out-poster <output-dir>/brag.jpg
```

What `--render` does automatically:
1. Captures the settled poster frame at `--poster-time` to `<output-dir>/brag.jpg`.
2. Renders every frame at `30fps` (`frame / 30` seconds) via `window.seekTo(t)`, substituting `brag.jpg` as **frame 0** so social platforms (X, Slack, Discord, LinkedIn) display the poster as the idle video thumbnail without changing frame count, duration, or audio sync.
3. Mixes the music track, timed Kenney SFX cues, and optional voiceover from `audio-mix.json` using FFmpeg (`libx264`, `-crf 18`, `-pix_fmt yuv420p`, `aac 192k`, `-movflags +faststart`).

*(Note: If you ever need to bake a new `brag.jpg` onto an already-rendered `brag.mp4` manually via FFmpeg, use:)*
```bash
ffmpeg -y -i brag.mp4 -i brag.jpg \
  -filter_complex "[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]" \
  -map "[v]" -map "0:a?" -c:v libx264 -crf 18 -preset fast -pix_fmt yuv420p \
  -c:a copy -movflags +faststart brag.poster.mp4 \
  && mv brag.poster.mp4 brag.mp4
```

### 2.2 Write `<output-dir>/share-copy.txt`

Write 1–3 punchy sentences tailored to the project and tone:
- Specific to the product's actual claims and personality.
- Ready to paste into X/Twitter, LinkedIn, or Discord.
- Never use generic phrases like `"Excited to share"` or `"Thrilled to announce"`.

### 2.3 Final Output Tree

Verify that `<output-dir>/` contains:

```text
<output-dir>/
  brag.mp4                  # 30fps H.264/AAC video with frame-0 poster baked in
  brag.jpg                  # Settled poster frame
  brag-plan.md              # Product rubric, beat-synced storyboard, and pacing math
  share-copy.txt            # Postable 1-3 sentence launch caption
  composition/
    index.html              # Self-contained deterministic HTML/CSS/JS composition
    audio-mix.json          # Music bed + timed SFX mix manifest
    assets/                 # Local copies of music, SFX, and product media
  work/
    qa/
      qa-15pct.png          # Visually verified 15% keyframe
      qa-40pct.png          # Visually verified 40% keyframe
      qa-65pct.png          # Visually verified 65% keyframe
      qa-90pct.png          # Visually verified 90% keyframe
      poster-candidate.png  # Visually verified poster frame
      qa-report.json        # Automated DOM overflow audit report
```
