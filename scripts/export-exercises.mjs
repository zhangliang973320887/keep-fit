#!/usr/bin/env node
/**
 * Export every exercise from free-exercise-db into one folder per exercise.
 *
 * Each folder gets:
 *   <exercise_id>/
 *     0.jpg            - start position photo (when available)
 *     1.jpg            - end position photo
 *     description.md   - structured English description (name, muscles, equipment, instructions)
 *     prompt.txt       - suggested AI image-to-video prompt
 *
 * Top-level files:
 *   exercises-export/
 *     index.json       - flat list of all exercises with key metadata
 *     README.md        - what's in this folder
 *
 * Usage:
 *   node scripts/export-exercises.mjs               # all 873
 *   node scripts/export-exercises.mjs --limit 10    # first 10 (sanity test)
 *   node scripts/export-exercises.mjs --out /tmp/x  # custom output dir
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------- config ----------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_URL =
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json";
const IMG_BASE =
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";
const DEFAULT_OUT = path.join(ROOT, "exercises-export");
const DEFAULT_CONCURRENCY = 8;

// ---------- args ----------
function parseArgs(argv) {
  const out = { limit: null, outDir: DEFAULT_OUT, concurrency: DEFAULT_CONCURRENCY };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") out.limit = parseInt(argv[++i], 10);
    else if (a === "--out") out.outDir = path.resolve(argv[++i]);
    else if (a === "--concurrency") out.concurrency = parseInt(argv[++i], 10);
    else if (a === "-h" || a === "--help") {
      console.log(
        "Usage: node scripts/export-exercises.mjs [--limit N] [--out DIR] [--concurrency N]",
      );
      process.exit(0);
    } else {
      console.warn(`Unknown arg: ${a}`);
    }
  }
  return out;
}

const args = parseArgs(process.argv);

// ---------- helpers ----------
async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function downloadFile(url, dest) {
  // Skip if already exists and non-empty (idempotent re-run)
  try {
    const stat = await fs.stat(dest);
    if (stat.size > 0) return "skipped";
  } catch {
    /* doesn't exist */
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  return "downloaded";
}

function titleCase(s) {
  return (s ?? "").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildDescription(ex) {
  const lines = [];
  lines.push(`# ${ex.name}`);
  lines.push("");
  lines.push(`**ID**: \`${ex.id}\``);
  lines.push("");
  lines.push("## Metadata");
  lines.push("");
  lines.push(`- **Type**: ${titleCase(ex.category || "")}`);
  if (ex.level) lines.push(`- **Level**: ${titleCase(ex.level)}`);
  if (ex.mechanic) lines.push(`- **Mechanic**: ${titleCase(ex.mechanic)}`);
  if (ex.force) lines.push(`- **Force**: ${titleCase(ex.force)}`);
  if (ex.equipment) lines.push(`- **Equipment**: ${titleCase(ex.equipment)}`);
  lines.push("");
  if (ex.primaryMuscles?.length) {
    lines.push("## Primary muscles");
    lines.push("");
    ex.primaryMuscles.forEach((m) => lines.push(`- ${titleCase(m)}`));
    lines.push("");
  }
  if (ex.secondaryMuscles?.length) {
    lines.push("## Secondary muscles");
    lines.push("");
    ex.secondaryMuscles.forEach((m) => lines.push(`- ${titleCase(m)}`));
    lines.push("");
  }
  if (ex.instructions?.length) {
    lines.push("## Instructions");
    lines.push("");
    ex.instructions.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    lines.push("");
  }
  if (ex.images?.length) {
    lines.push("## Images");
    lines.push("");
    ex.images.forEach((img, i) => {
      const ext = path.extname(img) || ".jpg";
      lines.push(`- \`${i}${ext}\` — ${i === 0 ? "start position" : "end position"}`);
    });
    lines.push("");
  }
  return lines.join("\n");
}

function buildAIPrompt(ex) {
  const eq = ex.equipment && ex.equipment !== "body only" ? ex.equipment : "no equipment, bodyweight only";
  const muscles = (ex.primaryMuscles || []).map(titleCase).join(", ") || "full body";
  const stepsSummary = (ex.instructions || [])
    .slice(0, 4)
    .map((s) => s.trim())
    .join(" ");

  return `Image-to-video prompt for: ${ex.name}

== Setting ==
A clean, well-lit modern gym. Side-view camera at chest height, static shot, 16:9 framing.

== Subject ==
A single athletic adult in fitness attire (t-shirt, shorts/leggings), neutral expression, no logos.

== Equipment ==
${titleCase(eq)}.

== Target muscles ==
${muscles}${ex.secondaryMuscles?.length ? ` (with secondary engagement of ${ex.secondaryMuscles.map(titleCase).join(", ")})` : ""}.

== Motion ==
The subject performs ONE clean, controlled repetition of "${ex.name}".
${stepsSummary || "Smooth, biomechanically correct execution from start position to end position and back."}

== Camera & style ==
- Static side-view camera, no movement.
- Realistic photographic style, sharp focus on subject.
- Smooth real-time motion (not slow-motion), single repetition lasting 3-5 seconds.
- Loopable: end frame matches start frame.

== Hard constraints (avoid) ==
- Do NOT morph or distort limbs / equipment / weights.
- Do NOT show incorrect form (knees collapsing inward on squats, rounded back on hinges, etc).
- Do NOT add extra people, audience, mirrors with reflections.
- Maintain consistent body shape throughout the entire clip.

== Output ==
3-5 second MP4, 1024x576 or 16:9, 24-30 fps.
`;
}

function buildIndexEntry(ex) {
  return {
    id: ex.id,
    name: ex.name,
    category: ex.category,
    level: ex.level,
    mechanic: ex.mechanic,
    force: ex.force,
    equipment: ex.equipment,
    primaryMuscles: ex.primaryMuscles,
    secondaryMuscles: ex.secondaryMuscles,
    imageCount: ex.images?.length ?? 0,
  };
}

function buildTopReadme(total, outDir) {
  return `# Exercises export

Generated by \`scripts/export-exercises.mjs\` from
[yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) (MIT license).

## What's here

- \`<exercise_id>/\` — one folder per exercise (${total} total)
  - \`0.jpg\` — start position
  - \`1.jpg\` — end position
  - \`description.md\` — structured English description (metadata + step-by-step instructions)
  - \`prompt.txt\` — ready-to-paste AI image-to-video generation prompt

- \`index.json\` — flat list of all exercises with key metadata (use for batch processing)

## How to use for AI video generation

Pick an exercise folder. Feed \`0.jpg\` (start position photo) as the input image and the
contents of \`prompt.txt\` as the text prompt to your image-to-video tool of choice
(可灵 / 即梦 / Veo / Runway / etc). The prompt explicitly forbids common AI failure
modes (morphing limbs, wrong form) and asks for a loopable 3-5s clip.

For batch processing, iterate over \`index.json\` and call your tool's API with the
matching folder's image+prompt.

## License notes

- Images and instructions: MIT (from free-exercise-db)
- Generated AI prompt: yours to use however
- AI-generated videos derived from these images: yours (subject to the AI tool's ToS)
`;
}

// ---------- main ----------
async function processExercise(ex, idx, total) {
  const folder = path.join(args.outDir, ex.id);
  await ensureDir(folder);

  let downloaded = 0;
  let skipped = 0;
  for (let i = 0; i < (ex.images || []).length; i++) {
    const imgPath = ex.images[i];
    const ext = path.extname(imgPath) || ".jpg";
    const url = IMG_BASE + imgPath;
    const dest = path.join(folder, `${i}${ext}`);
    try {
      const result = await downloadFile(url, dest);
      if (result === "downloaded") downloaded++;
      else skipped++;
    } catch (e) {
      console.warn(`  ! ${ex.id}/${i}: ${e.message}`);
    }
  }
  await fs.writeFile(path.join(folder, "description.md"), buildDescription(ex));
  await fs.writeFile(path.join(folder, "prompt.txt"), buildAIPrompt(ex));

  return { downloaded, skipped };
}

async function runPool(items, fn, concurrency) {
  let next = 0;
  let dl = 0,
    sk = 0;
  const start = Date.now();
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      try {
        const r = await fn(items[idx], idx, items.length);
        dl += r.downloaded;
        sk += r.skipped;
      } catch (e) {
        console.error(`  ✗ ${items[idx].id}: ${e.message}`);
      }
      // Progress every 20 items
      if ((idx + 1) % 20 === 0 || idx === items.length - 1) {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        console.log(
          `  ${idx + 1}/${items.length} (${dl} downloaded, ${sk} cached, ${elapsed}s)`,
        );
      }
    }
  });
  await Promise.all(workers);
  return { downloaded: dl, skipped: sk };
}

async function main() {
  console.log("==> Exercise exporter");
  console.log(`    Output: ${args.outDir}`);
  console.log(`    Concurrency: ${args.concurrency}`);
  if (args.limit) console.log(`    Limit: first ${args.limit}`);

  console.log("==> Fetching exercise list…");
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${DATA_URL}`);
  let exercises = await res.json();
  console.log(`  ✓ Got ${exercises.length} exercises`);
  if (args.limit) exercises = exercises.slice(0, args.limit);

  await ensureDir(args.outDir);

  // index.json + README
  const index = exercises.map(buildIndexEntry);
  await fs.writeFile(
    path.join(args.outDir, "index.json"),
    JSON.stringify(index, null, 2),
  );
  await fs.writeFile(
    path.join(args.outDir, "README.md"),
    buildTopReadme(exercises.length, args.outDir),
  );

  console.log(`==> Exporting ${exercises.length} exercises…`);
  const { downloaded, skipped } = await runPool(
    exercises,
    processExercise,
    args.concurrency,
  );
  console.log("");
  console.log(`✓ Done.`);
  console.log(`  Exercises:    ${exercises.length}`);
  console.log(`  Images dl:    ${downloaded}`);
  console.log(`  Images cache: ${skipped}`);
  console.log(`  Output:       ${args.outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
