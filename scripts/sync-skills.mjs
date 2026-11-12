#!/usr/bin/env node
/**
 * sync-skills.mjs
 *
 * Materializes skills/brag and skills/brag-slim into agent discovery paths
 * (replacing fragile relative symlinks with real files) and validates
 * YAML frontmatter, asset/script paths, and sync consistency.
 *
 * Usage:
 *   node scripts/sync-skills.mjs            # Materialize into repo discovery paths (.agents/skills, etc.)
 *   node scripts/sync-skills.mjs --global   # Also install to ~/.gemini/config/skills/ and ~/.agents/skills/
 *   node scripts/sync-skills.mjs --check    # Validate frontmatter, relative paths, zero symlinks, and sync state
 */

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsSourceDir = path.join(root, "skills");
const skillNames = ["brag", "brag-slim"];

const repoDiscoveryRoots = [
  path.join(root, ".agents", "skills"),
  path.join(root, ".claude", "skills"),
  path.join(root, ".opencode", "skills"),
];

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  const meta = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      meta[key] = val;
    }
  }
  return meta;
}

function findSymlinksRecursive(dir, found = []) {
  if (!existsSync(dir)) return found;
  const st = lstatSync(dir);
  if (st.isSymbolicLink()) {
    found.push(dir);
    return found;
  }
  if (!st.isDirectory()) return found;
  for (const entry of readdirSync(dir)) {
    if (entry === ".DS_Store" || entry === ".venv" || entry === "node_modules") continue;
    findSymlinksRecursive(path.join(dir, entry), found);
  }
  return found;
}

function materializeTarget(srcDir, destDir) {
  if (existsSync(destDir) || lstatSafe(destDir)) {
    rmSync(destDir, { recursive: true, force: true });
  }
  mkdirSync(path.dirname(destDir), { recursive: true });
  cpSync(srcDir, destDir, {
    recursive: true,
    dereference: true,
    filter: (src) => {
      const base = path.basename(src);
      return base !== ".DS_Store" && base !== ".venv" && base !== "__pycache__";
    },
  });
}

function lstatSafe(p) {
  try {
    return lstatSync(p);
  } catch {
    return null;
  }
}

function syncSkills({ includeGlobal = false } = {}) {
  const targets = [...repoDiscoveryRoots];
  if (includeGlobal) {
    const home = os.homedir();
    targets.push(
      path.join(home, ".gemini", "config", "skills"),
      path.join(home, ".agents", "skills")
    );
  }

  for (const targetRoot of targets) {
    for (const skill of skillNames) {
      const src = path.join(skillsSourceDir, skill);
      const dest = path.join(targetRoot, skill);
      materializeTarget(src, dest);
      console.log(`Synced ${skill} -> ${path.relative(root, dest) || dest}`);
    }
  }
}

function checkSkills() {
  const errors = [];

  for (const skill of skillNames) {
    const skillDir = path.join(skillsSourceDir, skill);
    const skillMdPath = path.join(skillDir, "SKILL.md");
    if (!existsSync(skillMdPath)) {
      errors.push(`Missing ${skillMdPath}`);
      continue;
    }
    const content = readFileSync(skillMdPath, "utf8");
    const fm = parseFrontmatter(content);
    if (!fm || !fm.name || !fm.description) {
      errors.push(`Invalid YAML frontmatter in skills/${skill}/SKILL.md (requires name & description)`);
    } else if (fm.name !== skill) {
      errors.push(`Frontmatter name "${fm.name}" does not match directory "${skill}"`);
    }

    if (/Opus 5\.5/i.test(content) || /slim\.md/i.test(content)) {
      errors.push(`Found legacy Claude Opus / slim.md gate in skills/${skill}/SKILL.md`);
    }

    // Check markdown links in SKILL.md
    for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
      const ref = match[1];
      if (/^[a-z]+:/i.test(ref) || ref.startsWith("#")) continue;
      const resolved = path.resolve(skillDir, ref);
      if (!existsSync(resolved)) {
        errors.push(`Broken relative link in skills/${skill}/SKILL.md: ${ref}`);
      }
    }
  }

  // Required files in skills/brag
  const requiredBragPaths = [
    "skills/brag/scripts/render_composition.mjs",
    "skills/brag/scripts/analyze_music_cues.py",
    "skills/brag/assets/music",
    "skills/brag/assets/music/cues",
    "skills/brag/assets/sfx",
    "skills/brag/references/step-1-inspect.md",
    "skills/brag/references/step-2-plan.md",
    "skills/brag/references/step-3-compose.md",
    "skills/brag/references/step-4-deliver.md",
    "skills/brag/references/audio.md",
    "skills/brag/references/tones.md",
  ];
  for (const rel of requiredBragPaths) {
    if (!existsSync(path.join(root, rel))) {
      errors.push(`Missing required path: ${rel}`);
    }
  }

  // Ensure no symlinks exist in skills/ or repoDiscoveryRoots
  const symlinkDirs = [skillsSourceDir, ...repoDiscoveryRoots];
  for (const dir of symlinkDirs) {
    const symlinks = findSymlinksRecursive(dir);
    for (const sym of symlinks) {
      errors.push(`Found fragile symlink (must be materialized directory): ${path.relative(root, sym)}`);
    }
  }

  // Ensure materialized SKILL.md files match canonical skills/
  for (const targetRoot of repoDiscoveryRoots) {
    for (const skill of skillNames) {
      const srcMd = path.join(skillsSourceDir, skill, "SKILL.md");
      const destMd = path.join(targetRoot, skill, "SKILL.md");
      if (!existsSync(destMd)) {
        errors.push(`Missing materialized skill file: ${path.relative(root, destMd)}`);
      } else if (readFileSync(srcMd, "utf8") !== readFileSync(destMd, "utf8")) {
        errors.push(
          `Out-of-sync SKILL.md at ${path.relative(root, destMd)}. Run: node scripts/sync-skills.mjs`
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error("Skill packaging & discovery check failed:");
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    "Skill packaging & discovery check passed: valid YAML frontmatter, verified asset/script paths, materialized discovery directories, and zero symlinks."
  );
}

const argv = process.argv.slice(2);
if (argv.includes("--check")) {
  checkSkills();
} else {
  syncSkills({ includeGlobal: argv.includes("--global") });
  checkSkills();
}
