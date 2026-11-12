# Audio, Beat-Sync & FFmpeg Mixing Reference

All bundled SFX in `<skill-dir>/assets/sfx/` are CC0 (Kenney.nl / OpenGameArt). All bundled music tracks in `<skill-dir>/assets/music/` are CC BY 4.0 by Sascha Ende (`ende.app`). Include both a music bed and tasteful motion-matched SFX by default unless `--no-music` or `--no-sfx` is passed.

---

## 1. Bundled Music Tracks & Precomputed Beat/Cue Presets

Music tracks live in `<skill-dir>/assets/music/`, and their precomputed beat grids and strong cues live in `<skill-dir>/assets/music/cues/`:

| Track Filename | Duration | Character | Best Tones |
|---|---|---|---|
| `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` | 2:44 | Upbeat, crisp, energetic | `default`, `app-store` |
| `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` | 1:54 | Mid-energy, laid-back groove | `default`, `yc-parody` |
| `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` | 1:00 | Compact, punchy loop | `default`, `chaotic` |
| `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` | 1:28 | Warm, earnest corporate pulse | `yc-parody`, `app-store` |
| `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` | 1:58 | Steady, clean, restrained | `polished`, `cinematic`, `deadpan` |

### Using Precomputed Music Cues (`<skill-dir>/assets/music/cues/`)
Each bundled track has:
- `<track-stem>.music-cues.md` — Human-readable tempo (BPM), beat grid (`0.0–25.0s`), and top `strongCues` (`strong_beat` / `onset_peak`).
- `<track-stem>.music-cues.json` — Full JSON with `tempo`, `beats[]`, and `strongCues[]`.

**Beat-Sync Rules:**
1. **Major Cuts / Hero Reveals (`strongCues`):** Lock 1–3 major scene transitions or hero reveals within `±0.15s` of a `strongCue` timestamp.
2. **Sequential Reveals (`beats`):** Align card arrivals, spec rows, or counter ticks within `±0.10s` of consecutive beat timestamps (or every other beat if beats are `< 0.55s` apart so text respects the `0.3s/word` reading floor).
3. **Custom Audio Tracks (Optional):** To generate cue files for a custom audio file when Python + `librosa` are available:
   ```bash
   python3 <skill-dir>/scripts/analyze_music_cues.py <track>.mp3 \
     --output-json <output-dir>/work/<stem>.music-cues.json \
     --output-md  <output-dir>/work/<stem>.music-cues.md
   ```

---

## 2. Approved SFX Library (`<skill-dir>/assets/sfx/`)

Consult `<skill-dir>/assets/sfx/sfx-analysis.md` for spectral/high-frequency notes. Prefer low/medium HF-risk sounds for repeated UI actions.

### `interface/` — Crisp UI Accents
| Files | Character | Use For |
|---|---|---|
| `click_001–005.ogg` | Sharp, precise click | Button tap, CTA press, simulated cursor click |
| `switch_001–002.ogg`, `switch_004–007.ogg` | Toggle switch | Mode switch, badge activation |
| `drop_001–003.ogg` | Soft pop/drop | Badge or callout landing |
| `bong_001.ogg` | Deep warm bell | Subtle polished reveal accent |
| `select_008.ogg` | Clean focus tick | Step transition, tab selection |
| `glitch_002.ogg`, `glitch_004.ogg` | Digital glitch | Chaotic cut or AI/tech parody beat |

### `impact/` — Physical & Cinematic Hits
| Files | Character | Use For |
|---|---|---|
| `impactSoft_medium_000–004.ogg` | Warm soft thud | Primary scene reveal, hero lock-in (safest all-rounder) |
| `impactSoft_heavy_000–004.ogg` | Deep soft thud | Heavy physical placement |
| `impactBell_heavy_000.ogg`, `_003.ogg`, `_004.ogg` | Resonant bell | Final logo slam, cinematic payoff |
| `impactWood_light_000–004.ogg`, `impactWood_medium_000–004.ogg` | Organic wood tap | Blueprint callouts, spec table rows |
| `impactPlate_light_000–004.ogg`, `impactMetal_light_002–003.ogg` | Crisp metallic ping | Engineering dimension ticks, precision badges |

### `casino/` — Cards, Slides & Counters
| Files | Character | Use For |
|---|---|---|
| `card-slide-1–8.ogg` | Smooth card slide | Profile cards, feature panels sliding in |
| `card-place-1–4.ogg` | Card landing | Staggered card grid settling |
| `chips-stack-1–6.ogg`, `chip-lay-1–3.ogg` | Tactile stack/confirm | Metric count-ups, spec confirmations |

### `ui/` & `keyboard/`
- `ui/mouseclick1.ogg`, `ui/click1–5.ogg`, `ui/rollover1–2.ogg` — Clean cursor clicks and hover ticks.
- `keyboard/keypress-001.wav` .. `keypress-032.wav` — 32 distinct keystrokes; randomize across files for typing animations.

---

## 3. Mixing Audio via `audio-mix.json` & FFmpeg Recipes

### 3.1 Declarative Mixing (`<output-dir>/composition/audio-mix.json`)
`render_composition.mjs --render` automatically reads `<output-dir>/composition/audio-mix.json` and constructs the FFmpeg `filter_complex` pipeline:

```json
{
  "music": {
    "src": "assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3",
    "volume": 0.34,
    "fadeIn": 0.4,
    "fadeOut": 1.4
  },
  "sfx": [
    { "src": "assets/sfx/impactSoft_medium_001.ogg", "time": 0.20, "volume": 0.72 },
    { "src": "assets/sfx/click_002.ogg", "time": 3.80, "volume": 0.68 },
    { "src": "assets/sfx/card-slide-1.ogg", "time": 8.15, "volume": 0.65 },
    { "src": "assets/sfx/impactBell_heavy_000.ogg", "time": 16.40, "volume": 0.75 }
  ]
}
```

**Volume Policy:**
- Music bed: `0.30–0.38` for `default`/`app-store`/`cinematic`/`chaotic`; `0.14–0.22` for `deadpan`/`yc-parody`/`polished`; `0.12–0.15` when ducked under `--voice`.
- SFX cues: `0.55–0.80` (fire `0.0–0.08s` after the visual entrance begins so sound and motion land together).

### 3.2 Direct FFmpeg CLI Recipe (With Voiceover Ducking)
When mixing manually or applying dynamic sidechain ducking under a `--voice` track (`voiceover.wav`), use FFmpeg's `adelay`, `afade`, and `sidechaincompress` / volume automation:

```bash
ffmpeg -y \
  -i video_no_audio.mp4 \
  -i assets/music/track.mp3 \
  -i assets/voiceover.wav \
  -i assets/sfx/impactSoft_medium_001.ogg \
  -i assets/sfx/click_002.ogg \
  -filter_complex "\
    [1:a]atrim=0:20,asetpts=PTS-STARTPTS,volume=0.34,afade=t=in:st=0:d=0.4,afade=t=out:st=18.6:d=1.4[bed]; \
    [2:a]adelay=400|400,volume=1.0,asplit=2[vo_sc][vo_mix]; \
    [bed][vo_sc]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=350[bed_ducked]; \
    [3:a]adelay=200|200,volume=0.72[sfx0]; \
    [4:a]adelay=3800|3800,volume=0.68[sfx1]; \
    [bed_ducked][vo_mix][sfx0][sfx1]amix=inputs=4:duration=first:dropout_transition=0:normalize=0[aout]" \
  -map 0:v:0 -map "[aout]" -c:v copy -c:a aac -b:a 192k output.mp4
```
