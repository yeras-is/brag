#!/usr/bin/env node
/**
 * render_composition.mjs
 *
 * Zero-dependency helper for /brag on Gemini & Google Antigravity.
 * Drives a local headless Chrome/Chromium via Chrome DevTools Protocol (CDP)
 * and encodes via FFmpeg.
 *
 * Modes:
 *   1. --qa:
 *      Renders keyframe PNGs at 15%, 40%, 65%, and 90% of the composition
 *      timeline (plus --poster-time) into --out-dir, along with a DOM
 *      overflow/clipping audit in qa-report.json.
 *      Gemini MUST inspect these PNGs with its native vision tool before
 *      running --render.
 *
 *   2. --render:
 *      Renders all frames deterministically at --fps (default 30) via
 *      window.seekTo(t), mixes music + SFX + optional voiceover from
 *      --audio-config (or audio-mix.json), extracts brag.jpg at
 *      --poster-time, and bakes brag.jpg as frame 0 of brag.mp4.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
};

function parseArgs(argv) {
  const args = {
    html: null,
    duration: null,
    fps: 30,
    width: 1920,
    height: 1080,
    qa: false,
    render: false,
    posterTime: null,
    outDir: null,
    outMp4: null,
    outPoster: null,
    audioConfig: null,
    noMusic: false,
    noSfx: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    switch (token) {
      case "--html":
        args.html = argv[++i];
        break;
      case "--duration":
        args.duration = parseFloat(argv[++i]);
        break;
      case "--fps":
        args.fps = parseInt(argv[++i], 10);
        break;
      case "--width":
        args.width = parseInt(argv[++i], 10);
        break;
      case "--height":
        args.height = parseInt(argv[++i], 10);
        break;
      case "--qa":
        args.qa = true;
        break;
      case "--render":
        args.render = true;
        break;
      case "--poster-time":
        args.posterTime = parseFloat(argv[++i]);
        break;
      case "--out-dir":
        args.outDir = argv[++i];
        break;
      case "--out-mp4":
        args.outMp4 = argv[++i];
        break;
      case "--out-poster":
        args.outPoster = argv[++i];
        break;
      case "--audio-config":
        args.audioConfig = argv[++i];
        break;
      case "--no-music":
        args.noMusic = true;
        break;
      case "--no-sfx":
        args.noSfx = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!args.html) {
    throw new Error("Missing required --html <path/to/composition/index.html>");
  }
  if (!args.qa && !args.render) {
    throw new Error("Specify at least one mode: --qa and/or --render");
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node render_composition.mjs --html <index.html> [options]

Options:
  --html <path>          Path to composition HTML file (required)
  --duration <sec>       Total composition duration in seconds (default: read window.__BRAG_DURATION or 20)
  --fps <num>            Frame rate for --render (default: 30)
  --width <px>           Viewport width (default: 1920)
  --height <px>          Viewport height (default: 1080)
  --qa                   Render 15%, 40%, 65%, and 90% keyframe PNGs + poster candidate
  --render               Render full 30fps MP4 + audio mix + frame-0 poster
  --poster-time <sec>    Timestamp for poster frame (default: 20% of duration)
  --out-dir <dir>        Output directory for --qa PNGs (default: <output-dir>/work/qa)
  --out-mp4 <path>       Output MP4 path for --render (default: <output-dir>/brag.mp4)
  --out-poster <path>    Output poster JPG path for --render (default: <output-dir>/brag.jpg)
  --audio-config <path>  Optional JSON specifying music, sfx, and voiceover tracks
  --no-music             Skip music track during audio mix
  --no-sfx               Skip SFX tracks during audio mix
`);
}

function findChromeBinary() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  const home = os.homedir();
  const puppeteerCache = path.join(home, ".cache", "puppeteer");
  if (existsSync(puppeteerCache)) {
    const found = findExecutableRecursive(puppeteerCache, [
      "chrome-headless-shell",
      "Google Chrome for Testing",
      "chrome",
    ]);
    if (found) return found;
  }

  const playwrightCache =
    process.platform === "darwin"
      ? path.join(home, "Library", "Caches", "ms-playwright")
      : path.join(home, ".cache", "ms-playwright");
  if (existsSync(playwrightCache)) {
    const found = findExecutableRecursive(playwrightCache, [
      "chrome-headless-shell",
      "Chromium",
      "chrome",
    ]);
    if (found) return found;
  }

  for (const cmd of ["google-chrome", "chromium", "chromium-browser"]) {
    const res = spawnSync("which", [cmd], { encoding: "utf8" });
    if (res.status === 0 && res.stdout.trim()) {
      return res.stdout.trim();
    }
  }

  throw new Error(
    "Could not locate a local Chrome or Chromium binary. Set CHROME_BIN or install Google Chrome / Chromium."
  );
}

function findExecutableRecursive(dir, names, depth = 0) {
  if (depth > 5 || !existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && names.includes(entry.name)) {
      try {
        const st = statSync(full);
        if (st.mode & 0o111) return full;
      } catch {}
    } else if (entry.isDirectory()) {
      const sub = findExecutableRecursive(full, names, depth + 1);
      if (sub) return sub;
    }
  }
  return null;
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlObj = new URL(req.url, "http://127.0.0.1");
        let relPath = decodeURIComponent(urlObj.pathname);
        if (relPath === "/") relPath = "/index.html";
        const filePath = path.resolve(rootDir, "." + relPath);
        if (!filePath.startsWith(path.resolve(rootDir))) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }
        if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        res.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
        });
        res.end(readFileSync(filePath));
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

class CDPSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (err) => reject(err));
      ws.addEventListener("message", (event) => {
        const msg = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) {
            rej(new Error(`CDP error (${msg.error.code}): ${msg.error.message}`));
          } else {
            res(msg.result);
          }
        }
      });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
  }
}

async function launchHeadlessChrome(chromeBin, width, height) {
  const userDataDir = path.join(
    os.tmpdir(),
    `brag-chrome-${process.pid}-${Date.now()}`
  );
  mkdirSync(userDataDir, { recursive: true });

  const isHeadlessShell = path.basename(chromeBin).includes("chrome-headless-shell");
  const chromeArgs = [
    isHeadlessShell ? "--headless" : "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    `--window-size=${width},${height}`,
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--force-color-profile=srgb",
    "about:blank",
  ];

  const proc = spawn(chromeBin, chromeArgs, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  const wsEndpoint = await new Promise((resolve, reject) => {
    let stderrBuf = "";
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for Chrome DevTools listening URL.\n${stderrBuf}`));
    }, 15000);

    proc.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString();
      const match = stderrBuf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });

    proc.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Chrome exited prematurely with code ${code}.\n${stderrBuf}`));
    });
  });

  const urlObj = new URL(wsEndpoint);
  const listRes = await fetch(`http://${urlObj.host}/json/list`);
  const targets = await listRes.json();
  const pageTarget = targets.find((t) => t.type === "page") || targets[0];
  if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
    throw new Error("Could not find a debuggable page target in headless Chrome.");
  }

  const cdp = new CDPSession(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  return { proc, cdp, userDataDir };
}

async function seekAndAuditAt(cdp, timeSec, width, height, runAudit = false) {
  const expr = `
    (async () => {
      const t = ${Number(timeSec)};
      document.documentElement.style.setProperty('--t', String(t));
      if (typeof window.seekTo === 'function') {
        await window.seekTo(t);
      } else {
        for (const anim of document.getAnimations({ subtree: true })) {
          anim.pause();
          anim.currentTime = t * 1000;
        }
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (!${Boolean(runAudit)}) {
        return { ok: true };
      }

      const issues = [];
      const vw = ${Number(width)};
      const vh = ${Number(height)};
      const margin = 4;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node;
      let visibleTextCount = 0;
      while ((node = walker.nextNode())) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.15) {
          continue;
        }
        const directText = Array.from(node.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent.trim())
          .join(' ');
        if (!directText) continue;

        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        visibleTextCount++;

        if (
          rect.left < -margin ||
          rect.top < -margin ||
          rect.right > vw + margin ||
          rect.bottom > vh + margin
        ) {
          // Check if clipped by an ancestor with overflow hidden
          let clippedByAncestor = false;
          let p = node.parentElement;
          while (p && p !== document.body) {
            const ps = getComputedStyle(p);
            if (ps.overflow === 'hidden' || ps.overflowX === 'hidden' || ps.overflowY === 'hidden') {
              const pr = p.getBoundingClientRect();
              if (rect.right > pr.right + margin || rect.left < pr.left - margin || rect.bottom > pr.bottom + margin || rect.top < pr.top - margin) {
                clippedByAncestor = true;
              }
            }
            p = p.parentElement;
          }
          issues.push({
            type: clippedByAncestor ? 'text-clipped' : 'viewport-overflow',
            text: directText.slice(0, 60),
            rect: {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom),
            },
          });
        }
      }
      return { ok: issues.length === 0, visibleTextCount, issues };
    })()
  `;
  const evalRes = await cdp.send("Runtime.evaluate", {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  if (evalRes.exceptionDetails) {
    throw new Error(
      `Runtime error in composition at t=${timeSec}s: ${evalRes.exceptionDetails.text}`
    );
  }
  return evalRes.result.value;
}

async function captureScreenshotBuffer(cdp, format = "png", quality = 90) {
  const params = { format };
  if (format === "jpeg") params.quality = quality;
  const { data } = await cdp.send("Page.captureScreenshot", params);
  return Buffer.from(data, "base64");
}

function buildAudioFilterAndInputs(audioConfigPath, compositionDir, duration, noMusic, noSfx) {
  if (!audioConfigPath || !existsSync(audioConfigPath)) {
    return { extraInputs: [], filterComplex: null, hasAudio: false };
  }
  const cfg = JSON.parse(readFileSync(audioConfigPath, "utf8"));
  const extraInputs = [];
  const filterParts = [];
  const mixLabels = [];
  let inputIdx = 1; // 0 is the piped video stream

  const resolveAudioFile = (p) => {
    if (!p) return null;
    const candidate = path.isAbsolute(p) ? p : path.resolve(compositionDir, p);
    return existsSync(candidate) ? candidate : null;
  };

  // 1. Music track
  if (!noMusic && cfg.music && cfg.music.src) {
    const musicPath = resolveAudioFile(cfg.music.src);
    if (musicPath) {
      extraInputs.push("-i", musicPath);
      const vol = cfg.music.volume ?? 0.35;
      const fadeIn = cfg.music.fadeIn ?? 0.4;
      const fadeOut = cfg.music.fadeOut ?? 1.2;
      const fadeOutStart = Math.max(0, duration - fadeOut);
      let chain = `[${inputIdx}:a]atrim=0:${duration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${vol}`;
      if (fadeIn > 0) chain += `,afade=t=in:st=0:d=${fadeIn.toFixed(2)}`;
      if (fadeOut > 0) chain += `,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeOut.toFixed(2)}`;
      chain += `[music]`;
      filterParts.push(chain);
      mixLabels.push("[music]");
      inputIdx++;
    }
  }

  // 2. Voiceover track (optional)
  if (cfg.voiceover && cfg.voiceover.src) {
    const voPath = resolveAudioFile(cfg.voiceover.src);
    if (voPath) {
      extraInputs.push("-i", voPath);
      const vol = cfg.voiceover.volume ?? 1.0;
      const startMs = Math.round((cfg.voiceover.start ?? 0) * 1000);
      filterParts.push(
        `[${inputIdx}:a]adelay=${startMs}|${startMs},volume=${vol}[vo]`
      );
      mixLabels.push("[vo]");
      inputIdx++;
    }
  }

  // 3. SFX cues
  if (!noSfx && Array.isArray(cfg.sfx)) {
    cfg.sfx.forEach((cue, idx) => {
      const sfxPath = resolveAudioFile(cue.src);
      if (!sfxPath) return;
      extraInputs.push("-i", sfxPath);
      const vol = cue.volume ?? 0.7;
      const delayMs = Math.max(0, Math.round((cue.time ?? 0) * 1000));
      const label = `sfx${idx}`;
      filterParts.push(
        `[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=${vol}[${label}]`
      );
      mixLabels.push(`[${label}]`);
      inputIdx++;
    });
  }

  if (mixLabels.length === 0) {
    return { extraInputs: [], filterComplex: null, hasAudio: false };
  }

  const filterComplex =
    filterParts.join(";") +
    `;${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=longest:dropout_transition=0:normalize=0,atrim=0:${duration.toFixed(3)},asetpts=PTS-STARTPTS[aout]`;

  return { extraInputs, filterComplex, hasAudio: true };
}

async function main() {
  const args = parseArgs(process.argv);
  const htmlPath = path.resolve(args.html);
  if (!existsSync(htmlPath)) {
    throw new Error(`Composition HTML file not found: ${htmlPath}`);
  }

  const compositionDir = path.dirname(htmlPath);
  const outputRoot = path.dirname(compositionDir);
  const htmlFilename = path.basename(htmlPath);

  const chromeBin = findChromeBinary();
  const { server, port } = await startStaticServer(compositionDir);
  const { proc, cdp } = await launchHeadlessChrome(chromeBin, args.width, args.height);

  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: args.width,
      height: args.height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const pageUrl = `http://127.0.0.1:${port}/${encodeURIComponent(htmlFilename)}`;
    await cdp.send("Page.navigate", { url: pageUrl });

    // Wait for document ready + fonts + images
    await cdp.send("Runtime.evaluate", {
      expression: `
        (async () => {
          if (document.readyState !== 'complete') {
            await new Promise((r) => window.addEventListener('load', r, { once: true }));
          }
          if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
          }
          const imgs = Array.from(document.images);
          await Promise.all(
            imgs.map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise((r) => {
                    img.addEventListener('load', r, { once: true });
                    img.addEventListener('error', r, { once: true });
                  })
            )
          );
        })()
      `,
      awaitPromise: true,
    });

    // Determine duration
    let duration = args.duration;
    if (!duration || Number.isNaN(duration)) {
      const durRes = await cdp.send("Runtime.evaluate", {
        expression: `Number(window.__BRAG_DURATION || document.documentElement.dataset.duration || 20)`,
        returnByValue: true,
      });
      duration = Number(durRes.result.value) || 20;
    }

    const posterTime =
      args.posterTime !== null && !Number.isNaN(args.posterTime)
        ? args.posterTime
        : Number((duration * 0.2).toFixed(2));

    // Mode 1: Multimodal Visual QA Keyframes (15%, 40%, 65%, 90% + poster candidate)
    if (args.qa) {
      const qaDir = path.resolve(args.outDir || path.join(outputRoot, "work", "qa"));
      mkdirSync(qaDir, { recursive: true });

      const checkpoints = [
        { pct: 15, name: "qa-15pct.png", time: Number((duration * 0.15).toFixed(2)) },
        { pct: 40, name: "qa-40pct.png", time: Number((duration * 0.40).toFixed(2)) },
        { pct: 65, name: "qa-65pct.png", time: Number((duration * 0.65).toFixed(2)) },
        { pct: 90, name: "qa-90pct.png", time: Number((duration * 0.90).toFixed(2)) },
        { pct: "poster", name: "poster-candidate.png", time: posterTime },
      ];

      const report = {
        duration,
        width: args.width,
        height: args.height,
        posterTime,
        keyframes: [],
      };

      for (const cp of checkpoints) {
        const audit = await seekAndAuditAt(cdp, cp.time, args.width, args.height, true);
        const pngBuf = await captureScreenshotBuffer(cdp, "png");
        const outPath = path.join(qaDir, cp.name);
        writeFileSync(outPath, pngBuf);
        report.keyframes.push({
          label: cp.pct === "poster" ? "poster" : `${cp.pct}%`,
          timeSec: cp.time,
          path: outPath,
          domAuditPassed: audit.ok,
          visibleTextCount: audit.visibleTextCount,
          issues: audit.issues || [],
        });
        console.log(
          `[QA] Rendered ${cp.name} (t=${cp.time}s) -> ${outPath} (DOM overflow issues: ${(audit.issues || []).length})`
        );
      }

      const reportPath = path.join(qaDir, "qa-report.json");
      writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
      console.log(`[QA] Wrote visual QA report -> ${reportPath}`);
      console.log(
        `[QA] MANDATORY GATE: Inspect qa-15pct.png, qa-40pct.png, qa-65pct.png, qa-90pct.png, and poster-candidate.png with Gemini's vision tool before running --render.`
      );
    }

    // Mode 2: Full deterministic 30fps render + FFmpeg audio mix + frame-0 poster baking
    if (args.render) {
      const outMp4 = path.resolve(args.outMp4 || path.join(outputRoot, "brag.mp4"));
      const outPoster = path.resolve(args.outPoster || path.join(outputRoot, "brag.jpg"));
      mkdirSync(path.dirname(outMp4), { recursive: true });
      mkdirSync(path.dirname(outPoster), { recursive: true });

      const defaultAudioCfg = path.join(compositionDir, "audio-mix.json");
      const audioConfigPath = args.audioConfig
        ? path.resolve(args.audioConfig)
        : existsSync(defaultAudioCfg)
        ? defaultAudioCfg
        : null;

      // Capture poster frame first at posterTime
      await seekAndAuditAt(cdp, posterTime, args.width, args.height, false);
      const posterJpgBuf = await captureScreenshotBuffer(cdp, "jpeg", 95);
      writeFileSync(outPoster, posterJpgBuf);
      console.log(`[Render] Saved poster frame (t=${posterTime}s) -> ${outPoster}`);

      const totalFrames = Math.round(duration * args.fps);
      const rawMp4 = `${outMp4}.raw.mp4`;

      const { extraInputs, filterComplex, hasAudio } = buildAudioFilterAndInputs(
        audioConfigPath,
        compositionDir,
        duration,
        args.noMusic,
        args.noSfx
      );

      const ffArgs = [
        "-y",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "-framerate",
        String(args.fps),
        "-i",
        "-",
        ...extraInputs,
      ];

      if (hasAudio && filterComplex) {
        ffArgs.push(
          "-filter_complex",
          filterComplex,
          "-map",
          "0:v:0",
          "-map",
          "[aout]",
          "-c:v",
          "libx264",
          "-crf",
          "18",
          "-preset",
          "fast",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "192k"
        );
      } else {
        ffArgs.push(
          "-c:v",
          "libx264",
          "-crf",
          "18",
          "-preset",
          "fast",
          "-pix_fmt",
          "yuv420p"
        );
      }

      ffArgs.push("-movflags", "+faststart", rawMp4);

      console.log(
        `[Render] Rendering ${totalFrames} frames (${duration}s @ ${args.fps}fps) to ${outMp4}...`
      );

      const ffProc = spawn("ffmpeg", ffArgs, {
        stdio: ["pipe", "ignore", "pipe"],
      });

      let ffStderr = "";
      ffProc.stderr.on("data", (d) => {
        ffStderr += d.toString();
      });

      for (let frame = 0; frame < totalFrames; frame++) {
        // Frame 0 is baked immediately from posterJpgBuf so frame 0 is guaranteed to be brag.jpg!
        if (frame === 0) {
          const canWrite = ffProc.stdin.write(posterJpgBuf);
          if (!canWrite) {
            await new Promise((r) => ffProc.stdin.once("drain", r));
          }
          continue;
        }
        const t = frame / args.fps;
        await seekAndAuditAt(cdp, t, args.width, args.height, false);
        const frameBuf = await captureScreenshotBuffer(cdp, "jpeg", 92);
        const canWrite = ffProc.stdin.write(frameBuf);
        if (!canWrite) {
          await new Promise((r) => ffProc.stdin.once("drain", r));
        }
      }

      ffProc.stdin.end();
      const exitCode = await new Promise((r) => ffProc.on("close", r));
      if (exitCode !== 0) {
        throw new Error(`FFmpeg render failed with exit code ${exitCode}:\n${ffStderr}`);
      }

      renameSync(rawMp4, outMp4);
      console.log(`[Render] Baked poster as frame 0 and wrote final MP4 -> ${outMp4}`);
    }
  } finally {
    cdp.close();
    proc.kill("SIGKILL");
    server.close();
  }
}

main().catch((err) => {
  console.error(`[Error] ${err.message}`);
  process.exit(1);
});
