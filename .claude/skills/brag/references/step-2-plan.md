# Step 2: Write `brag-plan.md` & Beat-Sync Storyboard

Create `<output-dir>/brag-plan.md` as the single creative contract for the video.

```bash
mkdir -p <output-dir>/work/qa <output-dir>/composition/assets
```

## Required Structure of `<output-dir>/brag-plan.md`

```markdown
# Brag Plan: [App Name]

## 1. Overview & Angle
- **What is this app?**: [One sentence]
- **Creative angle**: [The hook, premise, or deadpan contrast specific to this project]
- **User flow to show**: [Beat 1 (entry) → Beat 2 (key action) → Beat 3 (result)]

## 2. Tone & Format
- **Tone preset**: [default / polished / yc-parody / chaotic / deadpan / cinematic / app-store]
- **Creative direction**: [Custom phrase]
- **Format**: [landscape 1920x1080 / vertical 1080x1920 / square 1080x1080] @ 30fps
- **Target duration**: [15–25s; sweet spot 18–22s]
- **Poster frame timestamp**: [e.g. 3.2s — settled hero or reveal beat]

## 3. Visual Identity (from Source)
- **Background**: [exact CSS value + hex equivalent]
- **Primary Text**: [exact CSS value + hex equivalent]
- **Accent / Brand**: [exact CSS value + hex equivalent]
- **Display Font**: [font family]
- **Body Font**: [font family]
- **Real Product Elements Reused**: [SVGs, UI cards, spec rows, interactive controls]

## 4. Audio & Beat-Sync Plan
- **Music Track**: `assets/music/<track>.mp3` (Tempo: [BPM] from `<skill-dir>/assets/music/cues/<stem>.music-cues.md`)
- **Strong Cue Locks (1–3 major moments within ±0.15s)**:
  - `[timestamp]s` (`strong_beat` / `onset_peak`) → [Scene cut / Hero reveal]
- **SFX Cues (`<skill-dir>/assets/sfx/`)**:
  - `[timestamp]s` → `assets/sfx/<category>/<file>` (Volume: `0.60–0.80`) — [Matched UI action]

## 5. Scene-by-Scene Storyboard (Strict Pacing Math)

### Scene 1 — [Hook Name] (`0.0s – 3.2s`, duration `3.2s`)
- **Primary Copy (max 6–8 words)**: `"[Exact copy]"` ([word count] words → min settled hold `[word_count * 0.3, min 1.2]s`)
- **Visual & Real UI Action**: [What product UI/SVG is on screen; how it enters (`0.3–0.6s cubic-bezier(0.22, 1, 0.36, 1)`); continuous drift during hold]
- **Stagger / Interaction**: [e.g. `100ms` stagger across 3 callout badges, or simulated cursor click at `1.4s`]
- **Audio / SFX**: [Cue lock + SFX timestamp]
- **Transition out**: [Hard cut on beat / staggered out-then-in / clean slide]

### Scene 2 — [Reveal / Flow Beat 1] (`3.2s – ...`)
...
```

## Enforcing Pacing Math at Plan Time

Before moving to Step 3, verify every scene against these hard numbers:
1. **Total duration:** Must sum to `15–25s` (`18–22s` preferred).
2. **Word budget:** Primary readable headline/claim per scene is **at most 6–8 words**.
3. **Settled hold time:**
   - Entrance animation (`0.3–0.6s`) + settled hold (`>= 1.2s` for headlines or `0.3s * words`, `>= 0.8s` for 1–3 word labels) + exit (`0.2–0.3s`) must fit inside the scene duration.
   - When staggering sequential text rows or cards (`80–120ms` stagger or every other beat at fast tempos), start the settled hold timer only **after the final item in the group has landed**.
4. **No muddy crossfades:** Never overlap two text-heavy scenes in a simultaneous opacity crossfade. Finish exiting Scene $N$ (or cut/wipe cleanly on a beat) before Scene $N+1$ text enters.
