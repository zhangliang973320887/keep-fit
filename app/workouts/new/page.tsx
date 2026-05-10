"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLang } from "@/components/LangProvider";
import ExerciseCard from "@/components/ExerciseCard";
import { loadExercises } from "@/lib/wger";
import { getWorkout, saveWorkout, uid } from "@/lib/storage";
import type { Exercise, Workout, WorkoutExercise } from "@/lib/types";
import { localizeCategory, localizeName } from "@/lib/exercise-translations";

function exerciseToWorkoutExercise(e: Exercise): WorkoutExercise {
  return {
    exerciseId: e.id,
    exerciseName: e.name,
    imageUrl: e.imageUrl,
    videoUrl: e.videoUrl ?? null,
    sets: 3,
    reps: 10,
    isTimeBased: false,
    restSeconds: 60,
    secondsPerRep: 3,
  };
}

export default function NewWorkoutPage() {
  return (
    <Suspense fallback={null}>
      <NewWorkoutPageInner />
    </Suspense>
  );
}

function NewWorkoutPageInner() {
  const { t, lang } = useLang();
  const router = useRouter();
  const search = useSearchParams();
  const editId = search.get("edit");
  const addId = search.get("add");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<WorkoutExercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loadingLib, setLoadingLib] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  // Hydrate when editing existing
  useEffect(() => {
    if (editId) {
      const w = getWorkout(editId);
      if (w) {
        setName(w.name);
        setDescription(w.description ?? "");
        setPicked(w.exercises);
      }
    }
  }, [editId]);

  // Load exercise library
  useEffect(() => {
    loadExercises()
      .then((data) => {
        setAllExercises(data);
        // If user came from /exercises with ?add=ID, prefill
        if (addId) {
          const e = data.find((ex) => ex.id === addId);
          if (e) {
            setPicked((cur) =>
              cur.some((p) => p.exerciseId === e.id) ? cur : [...cur, exerciseToWorkoutExercise(e)],
            );
          }
        }
      })
      .finally(() => setLoadingLib(false));
  }, [addId]);

  const categories = useMemo(() => {
    const s = new Set(allExercises.map((e) => e.category).filter(Boolean));
    return Array.from(s).sort();
  }, [allExercises]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allExercises.filter((e) => {
      if (category && e.category !== category) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.muscles.some((m) => m.toLowerCase().includes(q))
      );
    });
  }, [allExercises, query, category]);

  const togglePick = (e: Exercise) => {
    setPicked((cur) => {
      const existing = cur.findIndex((p) => p.exerciseId === e.id);
      if (existing >= 0) return cur.filter((_, i) => i !== existing);
      return [...cur, exerciseToWorkoutExercise(e)];
    });
  };

  const updatePicked = (idx: number, patch: Partial<WorkoutExercise>) => {
    setPicked((cur) => cur.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const removePicked = (idx: number) =>
    setPicked((cur) => cur.filter((_, i) => i !== idx));

  const move = (idx: number, dir: -1 | 1) => {
    setPicked((cur) => {
      const next = [...cur];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return cur;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const onSave = () => {
    if (!name.trim()) {
      alert(t("workoutName"));
      return;
    }
    if (picked.length === 0) {
      alert(t("noExercisesYet"));
      return;
    }
    const now = new Date().toISOString();
    const w: Workout = {
      id: editId || uid(),
      name: name.trim(),
      description: description.trim() || undefined,
      exercises: picked,
      createdAt: editId ? getWorkout(editId)?.createdAt ?? now : now,
      updatedAt: now,
    };
    saveWorkout(w);
    router.push("/workouts");
  };

  const pickedIds = new Set(picked.map((p) => p.exerciseId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{editId ? t("edit") : t("newWorkout")}</h1>
        <Link href="/workouts" className="text-sm text-slate-500 hover:underline">
          ← {t("back")}
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {t("workoutName")}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("workoutNamePlaceholder")}
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {t("workoutDescription")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{t("selectedExercises")} ({picked.length})</h2>
        {picked.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noExercisesYet")}</p>
        ) : (
          <ul className="space-y-2">
            {picked.map((p, idx) => (
              <li
                key={`${p.exerciseId}-${idx}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.exerciseName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl opacity-40">🏋️</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {idx + 1}. {localizeName(p.exerciseName, lang)}
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      <label className="block">
                        <span className="text-slate-500">{t("sets")}</span>
                        <input
                          type="number"
                          min={1}
                          value={p.sets}
                          onChange={(e) =>
                            updatePicked(idx, { sets: Math.max(1, +e.target.value || 1) })
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
                        />
                      </label>
                      <label className="block">
                        <span className="text-slate-500">
                          {p.isTimeBased ? t("duration") : t("reps")}
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={p.reps}
                          onChange={(e) =>
                            updatePicked(idx, { reps: Math.max(1, +e.target.value || 1) })
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
                        />
                      </label>
                      {!p.isTimeBased && (
                        <label className="block">
                          <span className="text-slate-500">{t("tempo")}</span>
                          <input
                            type="number"
                            min={1}
                            step={0.5}
                            value={p.secondsPerRep ?? 3}
                            onChange={(e) =>
                              updatePicked(idx, {
                                secondsPerRep: Math.max(1, +e.target.value || 3),
                              })
                            }
                            className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
                          />
                        </label>
                      )}
                      <label className="block">
                        <span className="text-slate-500">{t("rest")}</span>
                        <input
                          type="number"
                          min={0}
                          value={p.restSeconds}
                          onChange={(e) =>
                            updatePicked(idx, { restSeconds: Math.max(0, +e.target.value || 0) })
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
                        />
                      </label>
                      <label className="flex items-end gap-1.5">
                        <input
                          type="checkbox"
                          checked={p.isTimeBased}
                          onChange={(e) => updatePicked(idx, { isTimeBased: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-slate-600 dark:text-slate-400">
                          {t("timeBased")}
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => move(idx, -1)}
                      className="px-2 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-700 disabled:opacity-30"
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      className="px-2 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-700 disabled:opacity-30"
                      disabled={idx === picked.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removePicked(idx)}
                      className="px-2 py-0.5 text-xs rounded border border-red-300 text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{t("pickExercises")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="sm:col-span-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">
              {t("filterCategory")} — {t("filterAll")}
            </option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {localizeCategory(c, lang)}
              </option>
            ))}
          </select>
        </div>
        {loadingLib ? (
          <p className="text-slate-500 text-sm">{t("loadingExercises")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[600px] overflow-auto pr-1">
            {filtered.slice(0, 200).map((e) => (
              <ExerciseCard
                key={e.id}
                exercise={e}
                selected={pickedIds.has(e.id)}
                onClick={togglePick}
                rightSlot={
                  pickedIds.has(e.id) ? (
                    <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700">
                      ✓
                    </span>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </section>

      <div className="sticky bottom-3 flex justify-end">
        <button
          onClick={onSave}
          className="px-6 py-2.5 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700"
        >
          {t("saveWorkout")}
        </button>
      </div>
    </div>
  );
}
