"use client";

// Muscle highlight using pre-rendered Z-Anatomy PNGs.
//
// Layered approach:
//   - Base "all gray" body PNG (always visible)
//   - One transparent red-only overlay per highlighted muscle group, stacked on top
// Multi-muscle is automatic — pass an array, all primary muscles light up.
//
// Optional `pulseSeconds` prop drives a CSS keyframe pulse synced to the user's
// rep tempo (used during active phase of a workout to give a "muscle contracting"
// feel without manual hand-cranking).
//
// Asset source: Z-Anatomy CC-BY-SA, rendered via scripts/blender/zanatomy-render.py
// Files: public/muscle-anatomy/
//   base-{front,back}.png             — gray full body
//   <group>-{front,back}-overlay.png  — red-only muscle on transparent bg

import type { Lang } from "@/lib/types";

const MUSCLE_TO_SLUG: Record<string, string> = {
  abdominals: "abdominals",
  abductors: "abductors",
  adductors: "adductors",
  biceps: "biceps",
  calves: "calves",
  chest: "chest",
  forearms: "forearms",
  glutes: "glutes",
  hamstrings: "hamstrings",
  lats: "lats",
  "lower back": "lower_back",
  "middle back": "middle_back",
  neck: "neck",
  quadriceps: "quadriceps",
  shoulders: "shoulders",
  traps: "traps",
  triceps: "triceps",
};

function muscleSlug(name: string): string | null {
  const key = (name ?? "").toLowerCase().trim();
  return MUSCLE_TO_SLUG[key] ?? null;
}

interface Props {
  primary: string[];
  secondary?: string[];
  size?: number; // px wide per figure
  className?: string;
  view?: "both" | "anterior" | "posterior";
  /**
   * If set (>0), the highlighted muscle pulses with this period in seconds.
   * Best driven by the user's `secondsPerRep` setting from the run page.
   */
  pulseSeconds?: number;
  lang?: Lang;
}

const ANATOMY_DIR = "/muscle-anatomy";

export default function MuscleHighlight({
  primary,
  secondary = [],
  size = 130,
  className = "",
  view = "both",
  pulseSeconds,
}: Props) {
  const primarySlugs = Array.from(
    new Set(primary.map(muscleSlug).filter((s): s is string => !!s)),
  );
  const secondarySlugs = Array.from(
    new Set(
      secondary
        .map(muscleSlug)
        .filter((s): s is string => !!s && !primarySlugs.includes(s)),
    ),
  );

  const baseSrc = (orientation: "front" | "back") =>
    `${ANATOMY_DIR}/base-${orientation}.png`;
  const overlaySrc = (slug: string, orientation: "front" | "back") =>
    `${ANATOMY_DIR}/${slug}-${orientation}-overlay.png`;

  const pulseStyle =
    pulseSeconds && pulseSeconds > 0
      ? ({ "--pulse-duration": `${pulseSeconds}s` } as React.CSSProperties)
      : undefined;

  const primaryClass = pulseSeconds ? "muscle-pulse" : "";
  const secondaryClass = pulseSeconds
    ? "muscle-pulse-secondary"
    : "opacity-50";

  function Figure({ orientation }: { orientation: "front" | "back" }) {
    return (
      <div
        className="relative rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-100 dark:ring-slate-300"
        style={{ width: size, aspectRatio: "2 / 3", ...pulseStyle }}
      >
        {/* Layer 0: base body (gray) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={baseSrc(orientation)}
          alt={`${orientation} view`}
          className="absolute inset-0 w-full h-full object-contain"
          loading="lazy"
        />
        {/* Secondary muscles — faded overlay (or pulsing-secondary if enabled) */}
        {secondarySlugs.map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`sec-${s}-${orientation}`}
            src={overlaySrc(s, orientation)}
            alt=""
            className={`absolute inset-0 w-full h-full object-contain ${secondaryClass}`}
            loading="lazy"
          />
        ))}
        {/* Primary muscles — full opacity (or pulsing) */}
        {primarySlugs.map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`pri-${s}-${orientation}`}
            src={overlaySrc(s, orientation)}
            alt=""
            className={`absolute inset-0 w-full h-full object-contain ${primaryClass}`}
            loading="lazy"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex gap-2 items-end justify-center ${className}`}>
      {(view === "both" || view === "anterior") && <Figure orientation="front" />}
      {(view === "both" || view === "posterior") && <Figure orientation="back" />}
    </div>
  );
}
