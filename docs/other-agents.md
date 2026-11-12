# Using `/brag` with Google Antigravity, Gemini CLI & Other Agents

## Google Antigravity (AGY) & Gemini CLI

`/brag` is natively tuned for **Gemini** running inside **Google Antigravity** and **Gemini CLI**:

1. **Workspace Discovery (Zero Setup in This Repo):**
   - Antigravity automatically discovers materialized skills in `.agents/skills/brag/` and `.agents/skills/brag-slim/`.
2. **Global Installation Across All Projects:**
   - Run the bundled sync script to materialize `brag` and `brag-slim` into `~/.gemini/config/skills/` and `~/.agents/skills/`:
     ```bash
     node scripts/sync-skills.mjs --global
     ```
   - Or copy manually:
     ```bash
     mkdir -p ~/.gemini/config/skills
     cp -R skills/brag ~/.gemini/config/skills/brag
     ```
3. **Keeping Repo Discovery Paths in Sync After Editing `skills/`:**
   ```bash
   node scripts/sync-skills.mjs
   node scripts/sync-skills.mjs --check
   ```

## Agents Without Native `SKILL.md` Discovery (Cursor, Aider, Custom LLM Hosts)

### Option 1: Reference as a File Path
Point your agent's instruction loader at:
```text
path/to/skills/brag/SKILL.md
```

### Option 2: Copy the Skill Folder
Copy `skills/brag/` into your agent's skills directory:
```bash
cp -R skills/brag/ ~/.your-agent/skills/brag/
```

## Prerequisites

- **Node.js 22+**
- **Google Chrome / Chromium** on the machine
- **FFmpeg** (`ffmpeg` and `ffprobe`) on `PATH`
- *(Optional)* `npx hyperframes` only if invoking `/brag --hyperframes`
