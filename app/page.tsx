"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { getHistory, getWorkouts } from "@/lib/storage";
import type { HistoryEntry, Workout } from "@/lib/types";

export default function HomePage() {
  const { t } = useLang();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setWorkouts(getWorkouts());
    setHistory(getHistory());
  }, []);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">{t("homeTitle")}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{t("appTagline")}</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/exercises"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-brand-500 hover:shadow-sm transition bg-white dark:bg-slate-900"
        >
          <div className="text-2xl">📚</div>
          <div className="mt-2 font-semibold">{t("homeBrowseExercises")}</div>
          <div className="text-sm text-slate-500 mt-1">{t("homeBrowseExercisesSub")}</div>
        </Link>
        <Link
          href="/workouts/new"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-brand-500 hover:shadow-sm transition bg-white dark:bg-slate-900"
        >
          <div className="text-2xl">📝</div>
          <div className="mt-2 font-semibold">{t("homeBuildWorkout")}</div>
          <div className="text-sm text-slate-500 mt-1">{t("homeBuildWorkoutSub")}</div>
        </Link>
        <Link
          href="/workouts"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-brand-500 hover:shadow-sm transition bg-white dark:bg-slate-900"
        >
          <div className="text-2xl">▶️</div>
          <div className="mt-2 font-semibold">{t("homeStartWorkout")}</div>
          <div className="text-sm text-slate-500 mt-1">
            {t("workoutCount", { n: workouts.length })}
          </div>
        </Link>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">{t("homeRecentHistory")}</h2>
        {history.length === 0 ? (
          <p className="text-slate-500">{t("homeNoHistory")}</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {history.slice(0, 5).map((h) => (
              <li key={h.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{h.workoutName}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(h.completedAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm text-slate-500">
                  {t("unitMinutes", { n: Math.round(h.durationSeconds / 60) })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
