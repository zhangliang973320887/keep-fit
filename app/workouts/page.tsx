"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { deleteWorkout, getWorkouts } from "@/lib/storage";
import type { Workout } from "@/lib/types";

export default function WorkoutsPage() {
  const { t } = useLang();
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const w = await getWorkouts();
        if (!cancelled) setWorkouts(w);
      } catch {
        /* ProfileGate handles auth-failure UI */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    await deleteWorkout(id);
    setWorkouts(await getWorkouts());
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("myWorkouts")}</h1>
        <Link
          href="/workouts/new"
          className="px-4 py-2 rounded-full bg-brand-600 text-white hover:bg-brand-700 text-sm font-medium"
        >
          + {t("newWorkout")}
        </Link>
      </div>

      {workouts.length === 0 ? (
        <p className="text-slate-500 py-12 text-center">{t("noWorkouts")}</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {workouts.map((w) => (
            <li
              key={w.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col"
            >
              <div className="flex-1">
                <div className="font-semibold">{w.name}</div>
                {w.description && (
                  <div className="text-sm text-slate-500 mt-1">{w.description}</div>
                )}
                <div className="text-xs text-slate-500 mt-2">
                  {t("exerciseCount", { n: w.exercises.length })} ·{" "}
                  {new Date(w.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/workouts/${w.id}/run`}
                  className="flex-1 text-center px-3 py-1.5 rounded-full bg-brand-600 text-white text-sm hover:bg-brand-700"
                >
                  ▶ {t("startNow")}
                </Link>
                <Link
                  href={`/workouts/new?edit=${w.id}`}
                  className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 text-sm"
                >
                  {t("edit")}
                </Link>
                <button
                  onClick={() => onDelete(w.id)}
                  className="px-3 py-1.5 rounded-full border border-red-300 text-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-950"
                >
                  {t("delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
