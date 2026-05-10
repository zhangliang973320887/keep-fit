#!/usr/bin/env node
/**
 * Batch-generate exercise videos using Seedance via the bananapro.site gateway.
 *
 * Self-contained — does NOT require running export-exercises.mjs first. It will
 * fetch the dataset, build prompts inline, hit the API, poll for completion,
 * and download MP4s to exercises-export/<id>/video.mp4.
 *
 * Set BANANAPRO_API_KEY env var. Never paste the key into this file.
 *
 * Usage:
 *   BANANAPRO_API_KEY=sk-... node scripts/seedance-batch.mjs --limit 10
 *   BANANAPRO_API_KEY=sk-... node scripts/seedance-batch.mjs --duration 8 --resolution 720p
 *   BANANAPRO_API_KEY=sk-... node scripts/seedance-batch.mjs --dry-run
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const API_BASE = "https://gateway.bananapro.site";
const DATA_URL =
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json";
const IMG_BASE =
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";
const OUT_DIR = path.join(ROOT, "exercises-export");

const POLL_INTERVAL_MS = 6000;
const POLL_TIMEOUT_MS = 12 * 60 * 1000; // 12 min per task
const PER_ATTEMPT_TRIES = 2;

// ---------- args ----------
function parseArgs(argv) {
  const o = {
    limit: null,
    duration: "4",       // "4" | "8" | "12"
    resolution: "480p",  // "480p" | "720p"
    aspectRatio: "16:9",
    concurrency: 3,
    fixedLens: true,
    skipExisting: true,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--limit": o.limit = parseInt(argv[++i], 10); break;
      case "--duration": o.duration = argv[++i]; break;
      case "--resolution": o.resolution = argv[++i]; break;
      case "--aspect-ratio": o.aspectRatio = argv[++i]; break;
      case "--concurrency": o.concurrency = parseInt(argv[++i], 10); break;
      case "--no-fixed-lens": o.fixedLens = false; break;
      case "--no-skip-existing": o.skipExisting = false; break;
      case "--dry-run": o.dryRun = true; break;
      case "-h":
      case "--help":
        console.log(
`Usage: BANANAPRO_API_KEY=... node scripts/seedance-batch.mjs [options]

Options:
  --limit N             Process only the first N exercises
  --duration 4|8|12     Video length in seconds (default: 4)
  --resolution 480p|720p   (default: 480p)
  --aspect-ratio R      e.g. "16:9", "9:16", "1:1" (default: 16:9)
  --concurrency N       Parallel jobs (default: 3)
  --no-fixed-lens       Allow camera to move (default: fixed)
  --no-skip-existing    Re-generate even if video.mp4 exists (default: skip)
  --dry-run             List what would be processed without spending credits
`);
        process.exit(0);
    }
  }
  return o;
}
const args = parseArgs(process.argv);

// ---------- env ----------
const API_KEY = process.env.BANANAPRO_API_KEY;
if (!API_KEY && !args.dryRun) {
  console.error("✗ BANANAPRO_API_KEY env var not set");
  console.error("  Run: BANANAPRO_API_KEY=sk-... node scripts/seedance-batch.mjs --limit 10");
  process.exit(1);
}

// ---------- helpers ----------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function api(p, opts = {}) {
  const url = API_BASE + p;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || json.success === false) {
    throw new Error(
      `API ${res.status}: ${json.message || JSON.stringify(json).slice(0, 200)}`,
    );
  }
  return json.data;
}

function titleCase(s) {
  return (s ?? "").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Same prompt logic as scripts/export-exercises.mjs (kept inline so this script
// doesn't require export to have been run first).
function buildAIPrompt(ex) {
  const eq =
    ex.equipment && ex.equipment !== "body only"
      ? ex.equipment
      : "no equipment, bodyweight only";
  const muscles =
    (ex.primaryMuscles || []).map(titleCase).join(", ") || "full body";
  const stepsSummary = (ex.instructions || [])
    .slice(0, 4)
    .map((s) => s.trim())
    .join(" ");

  return `Image-to-video prompt for: ${ex.name}

== Setting ==
A clean, well-lit modern gym. Side-view camera at chest height, static shot, 16:9 framing.

== Subject ==
A single athletic adult in fitness attire (t-shirt, shorts/leggings), neutral expression.

== Equipment ==
${titleCase(eq)}.

== Target muscles ==
${muscles}${ex.secondaryMuscles?.length ? ` (with secondary engagement of ${ex.secondaryMuscles.map(titleCase).join(", ")})` : ""}.

== Motion ==
The subject performs ONE clean, controlled repetition of "${ex.name}".
${stepsSummary || "Smooth, biomechanically correct execution from start to end position."}

== Style ==
Realistic photographic style, sharp focus, smooth real-time motion, single repetition.
Loopable: end frame matches start frame.

== Hard constraints (avoid) ==
- Do NOT morph or distort limbs / equipment / weights.
- Do NOT show incorrect form (knees collapsing inward, rounded back, etc).
- Do NOT add extra people, audience, or mirrors with reflections.
- Maintain consistent body shape throughout the entire clip.
`.trim();
}

async function fetchDataset() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Fetch dataset HTTP ${res.status}`);
  return res.json();
}

async function getPromptForExercise(ex) {
  // Prefer prompt.txt from the export folder if it exists (lets you hand-tune)
  const exportPrompt = path.join(OUT_DIR, ex.id, "prompt.txt");
  try {
    const text = await fs.readFile(exportPrompt, "utf-8");
    if (text.trim().length > 0) return text;
  } catch {
    /* fall through */
  }
  return buildAIPrompt(ex);
}

async function submitJob(ex, opts) {
  let prompt = await getPromptForExercise(ex);
  if (prompt.length > 2500) prompt = prompt.slice(0, 2500);

  const imageUrls = (ex.images || []).slice(0, 2).map((p) => IMG_BASE + p);
  if (imageUrls.length === 0) {
    throw new Error(`Exercise ${ex.id} has no images`);
  }

  const body = {
    model: "seedance",
    type: "image-to-video",
    prompt,
    image_urls: imageUrls,
    aspect_ratio: opts.aspectRatio,
    duration: opts.duration,
    resolution: opts.resolution,
    fixed_lens: opts.fixedLens,
    generate_audio: false,
  };

  return api("/api/v1/videos/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function pollUntilDone(taskId) {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    const data = await api(`/api/v1/videos/${taskId}`);
    if (data.status === "completed") return data;
    if (data.status === "failed") {
      throw new Error(`Task ${taskId} failed: ${data.error || "(no detail)"}`);
    }
    // pending / running — keep polling
  }
  throw new Error(`Task ${taskId} timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

async function processOne(ex, opts) {
  const folder = path.join(OUT_DIR, ex.id);
  await ensureDir(folder);
  const dest = path.join(folder, "video.mp4");

  if (opts.skipExisting) {
    try {
      const stat = await fs.stat(dest);
      if (stat.size > 0) return { status: "skipped", dest };
    } catch {
      /* doesn't exist */
    }
  }

  // Try a couple times in case of transient errors
  let lastErr;
  for (let attempt = 1; attempt <= PER_ATTEMPT_TRIES; attempt++) {
    try {
      const submission = await submitJob(ex, opts);
      const result = await pollUntilDone(submission.task_id);
      if (!result.video_url) throw new Error("No video_url in completed task");
      await downloadFile(result.video_url, dest);
      return {
        status: "completed",
        dest,
        taskId: submission.task_id,
        creditsUsed: submission.credits_used,
      };
    } catch (e) {
      lastErr = e;
      if (attempt < PER_ATTEMPT_TRIES) {
        console.warn(`  ! ${ex.id} attempt ${attempt} failed, retrying: ${e.message}`);
        await sleep(3000);
      }
    }
  }
  throw lastErr;
}

// ---------- main ----------
async function main() {
  console.log("==> Seedance batch generator");
  console.log(`    Output: ${OUT_DIR}`);
  console.log(
    `    Config: duration=${args.duration}s, resolution=${args.resolution}, aspect=${args.aspectRatio}, concurrency=${args.concurrency}`,
  );
  if (args.dryRun) console.log("    DRY RUN — no API calls");

  // Fetch dataset
  console.log("==> Fetching exercise dataset…");
  const all = await fetchDataset();
  console.log(`  ✓ Got ${all.length} exercises`);

  // Pick the subset to process. Prefer those with 2 images so Seedance gets both poses.
  const eligible = all.filter((e) => (e.images || []).length >= 1);
  const items = args.limit ? eligible.slice(0, args.limit) : eligible;
  console.log(`  Processing ${items.length} exercise(s)`);

  if (args.dryRun) {
    console.log("\nFirst 5 picks:");
    items.slice(0, 5).forEach((ex) => {
      console.log(`  - ${ex.id} (${ex.images?.length ?? 0} images): ${ex.name}`);
    });
    return;
  }

  // Show balance
  try {
    const bal = await api("/api/v1/account/balances");
    console.log(`  Account balance: ${JSON.stringify(bal)}`);
  } catch (e) {
    console.warn(`  ! Could not fetch balance: ${e.message}`);
  }

  await ensureDir(OUT_DIR);

  // Concurrent worker pool
  let nextIdx = 0;
  let done = 0,
    failed = 0,
    skipped = 0,
    totalCredits = 0;
  const failures = [];
  const start = Date.now();

  const worker = async () => {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      const ex = items[idx];
      const tag = `[${idx + 1}/${items.length}] ${ex.id}`;
      try {
        const r = await processOne(ex, args);
        if (r.status === "skipped") {
          skipped++;
          console.log(`${tag} ⏭  already exists`);
        } else {
          done++;
          totalCredits += r.creditsUsed || 0;
          console.log(
            `${tag} ✓ ${r.dest} (credits: ${r.creditsUsed ?? "?"})`,
          );
        }
      } catch (e) {
        failed++;
        failures.push({ id: ex.id, name: ex.name, error: String(e.message || e) });
        console.error(`${tag} ✗ ${e.message}`);
      }
    }
  };

  await Promise.all(Array.from({ length: args.concurrency }, worker));

  if (failures.length > 0) {
    await fs.writeFile(
      path.join(OUT_DIR, "failed.json"),
      JSON.stringify(failures, null, 2),
    );
  }

  const elapsedMin = ((Date.now() - start) / 60000).toFixed(1);
  console.log("");
  console.log(
    `✓ Done in ${elapsedMin} min. Generated: ${done}, Skipped: ${skipped}, Failed: ${failed}`,
  );
  console.log(`  Credits used this run: ${totalCredits}`);
  if (failed > 0) {
    console.log(
      `  Failures saved to: exercises-export/failed.json (re-run script to retry — successful ones will be skipped)`,
    );
  }
}

main().catch((e) => {
  console.error("\n✗ Fatal:", e.message);
  process.exit(1);
});
