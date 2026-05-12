"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { getHistory, getWorkouts } from "@/lib/storage";
import type { HistoryEntry, Workout } from "@/lib/types";

export default function HomePage() {
  const { t } = useLang();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, h] = await Promise.all([getWorkouts(), getHistory()]);
        if (!cancelled) {
          setWorkouts(w);
          setHistory(h);
        }
      } catch {
        // Most likely not signed in / network blip — ProfileGate handles auth,
        // so we just leave the page empty.
      }
    })();
    // re-tick "X 分钟前" labels once a minute
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // ---- derived stats ----
  const stats = useMemo(() => computeStats(history, now), [history, now]);
  const greeting = useMemo(() => {
    const main = greetingMainFor(now, t);
    let sub = "";
    if (stats.streakDays >= 2) {
      sub = t("greetingStreakOn", { n: stats.streakDays });
    } else if (stats.thisWeekCount > 0) {
      sub = t("greetingThisWeek", { n: stats.thisWeekCount });
    } else if (history.length > 0) {
      sub = t("greetingNoneThisWeek");
    } else {
      sub = t("greetingFirstSession");
    }
    return { main, sub };
  }, [now, t, stats.streakDays, stats.thisWeekCount, history.length]);
  const hero = useMemo(
    () => pickHero(workouts, history, now, t),
    [workouts, history, now, t],
  );

  return (
    <div className="space-y-6">
      {/* Greeting strip — small, contextual, not the marketing headline */}
      <section className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {greeting.main}
        </h1>
        <span className="text-sm text-slate-500">{greeting.sub}</span>
      </section>

      {/* Hero card — the ONE thing to do right now */}
      {hero && <HeroCard hero={hero} />}

      {/* Stats strip — only render if there's any history */}
      {history.length > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard
            label={t("statThisWeek")}
            value={stats.thisWeekCount}
            unit={t("statSuffixTimes")}
            accent="sky"
          />
          <StatCard
            label={t("statActiveTime")}
            value={stats.thisWeekMinutes}
            unit={t("statSuffixMin")}
            accent="amber"
          />
          <StatCard
            label={t("statTotal")}
            value={stats.totalCount}
            unit={t("statSuffixTimes")}
            accent="slate"
          />
          <StatCard
            label={t("statStreak")}
            value={stats.streakDays}
            unit={t("statSuffixDays", { n: stats.streakDays })}
            accent="emerald"
          />
        </section>
      )}

      {/* Secondary actions — demoted from the giant tiles */}
      <section>
        <h2 className="text-sm font-medium text-slate-500 mb-2">
          {t("homeQuickActions")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <QuickAction
            href="/exercises"
            icon={<DumbbellMini />}
            label={t("homeBrowseExercises")}
            sub={t("homeBrowseExercisesSub")}
            accent="bg-sky-500"
          />
          <QuickAction
            href="/workouts/new"
            icon={<ClipboardMini />}
            label={t("homeBuildWorkout")}
            sub={t("homeBuildWorkoutSub")}
            accent="bg-amber-500"
          />
        </div>
      </section>

      {/* Recent — feels like a training journal, not a generic list */}
      {history.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-medium text-slate-500">
              {t("homeRecentHistory")}
            </h2>
            <Link
              href="/history"
              className="text-xs text-brand-600 hover:underline"
            >
              {t("historyTitle")} →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            {history.slice(0, 5).map((h) => (
              <li key={h.id}>
                <Link
                  href={
                    workouts.some((w) => w.id === h.workoutId)
                      ? `/workouts/${h.workoutId}/run`
                      : "/history"
                  }
                  className="flex items-center gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                >
                  <div className="w-9 h-9 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <DumbbellMini />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{h.workoutName}</div>
                    <div className="text-xs text-slate-500">
                      {formatWhen(h.completedAt, now, t)}
                    </div>
                  </div>
                  <div className="text-sm text-slate-500 tabular-nums shrink-0">
                    {Math.max(1, Math.round(h.durationSeconds / 60))}
                    <span className="text-xs ml-0.5">
                      {t("statSuffixMin")}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero card

interface Hero {
  variant: "continue" | "fresh" | "empty";
  title: string;
  routineName?: string;
  meta: string;
  href: string;
  cta: string;
}

function HeroCard({ hero }: { hero: Hero }) {
  return (
    <Link
      href={hero.href}
      className="block group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-950 text-white p-6 sm:p-7 shadow-sm hover:shadow-md transition"
    >
      {/* subtle accent stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-sky-400 to-sky-600" />
      {/* faint hint of texture using radial overlay */}
      <div
        className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-sky-500/10 blur-3xl pointer-events-none"
        aria-hidden
      />

      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-widest text-sky-300/80 font-medium">
            {hero.title}
          </div>
          {hero.routineName && (
            <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight truncate">
              {hero.routineName}
            </div>
          )}
          <div className="mt-1.5 text-sm text-slate-300">{hero.meta}</div>
        </div>
        <div className="shrink-0 flex items-center gap-2 rounded-full bg-white text-slate-900 px-5 py-2.5 font-semibold group-hover:bg-sky-100 transition">
          <span>{hero.cta}</span>
          <ArrowRight />
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Stat card

type Accent = "sky" | "amber" | "emerald" | "slate";

const ACCENT_TEXT: Record<Accent, string> = {
  sky: "text-sky-600 dark:text-sky-400",
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  slate: "text-slate-700 dark:text-slate-300",
};

function StatCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number;
  unit: string;
  accent: Accent;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-2xl font-bold tabular-nums ${ACCENT_TEXT[accent]}`}>
          {value}
        </span>
        {unit && (
          <span className="text-xs text-slate-500">{unit}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick action row

function QuickAction({
  href,
  icon,
  label,
  sub,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 bg-white dark:bg-slate-900 hover:border-brand-500 hover:shadow-sm transition"
    >
      <div
        className={`w-10 h-10 rounded-xl ${accent} text-white flex items-center justify-center shrink-0`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{label}</div>
        <div className="text-xs text-slate-500 truncate">{sub}</div>
      </div>
      <ArrowRight className="text-slate-400 shrink-0" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Tiny inline icons

function DumbbellMini() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 9v6" />
      <path d="M6.5 7v10" />
      <path d="M17.5 7v10" />
      <path d="M20.5 9v6" />
      <path d="M6.5 12h11" />
    </svg>
  );
}

function ClipboardMini() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6v3H9z" fill="currentColor" stroke="currentColor" />
      <path d="M9 11l2 2 4-4" />
      <path d="M9 17h6" />
    </svg>
  );
}

function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Pure helpers

function computeStats(history: HistoryEntry[], now: number) {
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  let thisWeekCount = 0;
  let thisWeekSeconds = 0;
  for (const h of history) {
    const t = new Date(h.completedAt).getTime();
    if (t >= weekAgo) {
      thisWeekCount += 1;
      thisWeekSeconds += h.durationSeconds;
    }
  }

  // Streak: bucket entries by local-day key, then count back from today.
  const dayKey = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const trainedDays = new Set(
    history.map((h) => dayKey(new Date(h.completedAt).getTime())),
  );
  let streak = 0;
  let cursor = new Date(now);
  // If today has no session, start counting from yesterday so the streak
  // doesn't break for someone who hasn't trained yet today.
  if (!trainedDays.has(dayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (trainedDays.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    thisWeekCount,
    thisWeekMinutes: Math.round(thisWeekSeconds / 60),
    totalCount: history.length,
    streakDays: streak,
  };
}

function greetingMainFor(now: number, t: (k: any, vars?: any) => string): string {
  const h = new Date(now).getHours();
  if (h < 5) return t("greetingNight");
  if (h < 12) return t("greetingMorning");
  if (h < 18) return t("greetingAfternoon");
  return t("greetingEvening");
}

function pickHero(
  workouts: Workout[],
  history: HistoryEntry[],
  now: number,
  t: (k: any, vars?: any) => string,
): Hero | null {
  // No routines at all → invite to build one.
  if (workouts.length === 0) {
    return {
      variant: "empty",
      title: t("heroEmptyTitle"),
      meta: t("heroEmptyMeta"),
      href: "/workouts/new",
      cta: t("heroEmptyCta"),
    };
  }

  // Try to continue the most recent routine the user actually trained.
  const lastEntry = history.find((h) =>
    workouts.some((w) => w.id === h.workoutId),
  );
  if (lastEntry) {
    const w = workouts.find((w) => w.id === lastEntry.workoutId)!;
    return {
      variant: "continue",
      title: t("heroContinueTitle"),
      routineName: w.name,
      meta: t("heroContinueMeta", {
        count: w.exercises.length,
        when: formatWhen(lastEntry.completedAt, now, t),
      }),
      href: `/workouts/${w.id}/run`,
      cta: t("heroStart"),
    };
  }

  // Routines exist but no completed history → suggest the most recent routine.
  const w = workouts[0];
  return {
    variant: "fresh",
    title: t("heroStartFreshTitle"),
    routineName: w.name,
    meta: t("heroStartFreshMeta", { count: w.exercises.length }),
    href: `/workouts/${w.id}/run`,
    cta: t("heroStart"),
  };
}

function formatWhen(
  iso: string,
  now: number,
  t: (k: any, vars?: any) => string,
): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  const weeks = Math.floor(days / 7);

  if (mins < 1) return t("timeJustNow");
  if (mins < 60) return t("timeMinAgo", { n: mins });
  if (hours < 24) return t("timeHourAgo", { n: hours });
  if (days < 7) return t("timeDayAgo", { n: days });
  if (weeks < 5) return t("timeWeekAgo", { n: weeks });

  // Fall back to a calendar date
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
