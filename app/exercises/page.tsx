"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LangProvider";
import ExerciseCard from "@/components/ExerciseCard";
import { getCacheTimestamp, loadExercises } from "@/lib/wger";
import type { Exercise } from "@/lib/types";
import Link from "next/link";
import {
  localizeCategory,
  localizeEquipment,
  localizeEquipmentList,
  localizeInstructions,
  localizeLevel,
  localizeMuscleList,
  localizeName,
  localizeType,
} from "@/lib/exercise-translations";
import MuscleHighlight from "@/components/MuscleHighlight";

export default function ExercisesPage() {
  const { t, lang } = useLang();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [equipment, setEquipment] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [cacheTime, setCacheTime] = useState<number | null>(null);

  const resetFilters = () => {
    setQuery("");
    setCategory("");
    setEquipment("");
    setLevel("");
    setType("");
  };

  const hasActiveFilter = !!(query || category || equipment || level || type);

  const load = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadExercises(force);
      setExercises(data);
      setCacheTime(getCacheTimestamp());
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  const categories = useMemo(() => {
    const s = new Set(exercises.map((e) => e.category).filter(Boolean));
    return Array.from(s).sort();
  }, [exercises]);

  const equipmentList = useMemo(() => {
    const s = new Set<string>();
    exercises.forEach((e) => e.equipment.forEach((eq) => s.add(eq)));
    return Array.from(s).sort();
  }, [exercises]);

  const levels = useMemo(() => {
    // Preserve a sensible ordering, not alphabetical (beginner < intermediate < expert)
    const order = ["beginner", "intermediate", "expert"];
    const present = new Set(exercises.map((e) => e.level).filter(Boolean));
    return order.filter((l) => present.has(l));
  }, [exercises]);

  const types = useMemo(() => {
    const s = new Set(exercises.map((e) => e.type).filter(Boolean));
    return Array.from(s).sort();
  }, [exercises]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (category && e.category !== category) return false;
      if (equipment && !e.equipment.includes(equipment)) return false;
      if (level && e.level !== level) return false;
      if (type && e.type !== type) return false;
      if (!q) return true;
      // Match against EN and ZH names so 中文 search works too.
      const zhName = localizeName(e.name, "zh").toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        zhName.includes(q) ||
        e.muscles.some((m) => m.toLowerCase().includes(q)) ||
        e.equipment.some((eq) => eq.toLowerCase().includes(q))
      );
    });
  }, [exercises, query, category, equipment, level, type]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">{t("navExercises")}</h1>
        <div className="flex items-center gap-2 text-sm">
          {cacheTime && (
            <span className="text-xs text-slate-500">
              {new Date(cacheTime).toLocaleString()}
            </span>
          )}
          <button
            onClick={() => load(true)}
            className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t("refresh")}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">
              {t("filterEquipment")} — {t("filterAll")}
            </option>
            {equipmentList.map((eq) => (
              <option key={eq} value={eq}>
                {localizeEquipment(eq, lang)}
              </option>
            ))}
          </select>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">
              {t("filterLevel")} — {t("filterAll")}
            </option>
            {levels.map((lv) => (
              <option key={lv} value={lv}>
                {localizeLevel(lv, lang)}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">
              {t("filterType")} — {t("filterAll")}
            </option>
            {types.map((tp) => (
              <option key={tp} value={tp}>
                {localizeType(tp, lang)}
              </option>
            ))}
          </select>
        </div>
        {hasActiveFilter && (
          <div className="flex justify-end">
            <button
              onClick={resetFilters}
              className="text-xs text-slate-500 hover:text-brand-600 hover:underline"
            >
              ✕ {t("resetFilters")}
            </button>
          </div>
        )}
      </div>

      {loading && <p className="text-slate-500">{t("loadingExercises")}</p>}
      {error && (
        <p className="text-red-600 dark:text-red-400">
          {t("errorLoading")} <span className="text-xs">({error})</span>
        </p>
      )}

      {!loading && !error && (
        <>
          <p className="text-sm text-slate-500">
            {t("resultsCount", { n: filtered.length })}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map((e) => (
              <ExerciseCard
                key={e.id}
                exercise={e}
                selected={selected?.id === e.id}
                onClick={(ex) => setSelected(ex)}
              />
            ))}
          </div>
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto shadow-xl">
            <div className="aspect-video bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden rounded-t-2xl">
              {selected.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.imageUrl}
                  alt={localizeName(selected.name, lang)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-5xl opacity-40">🏋️</span>
              )}
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xl font-semibold">
                    {localizeName(selected.name, lang)}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {localizeCategory(selected.category, lang)}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  aria-label="close"
                >
                  ✕
                </button>
              </div>
              {(selected.muscles.length > 0 || selected.musclesSecondary.length > 0) && (
                <div className="-my-2">
                  <MuscleHighlight
                    primary={selected.muscles}
                    secondary={selected.musclesSecondary}
                    size={150}
                  />
                </div>
              )}
              {selected.muscles.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {t("primaryMuscles")}
                  </div>
                  <div>{localizeMuscleList(selected.muscles, lang).join(", ")}</div>
                </div>
              )}
              {selected.musclesSecondary.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {t("secondaryMuscles")}
                  </div>
                  <div>
                    {localizeMuscleList(selected.musclesSecondary, lang).join(", ")}
                  </div>
                </div>
              )}
              {selected.equipment.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {t("equipment")}
                  </div>
                  <div>{localizeEquipmentList(selected.equipment, lang).join(", ")}</div>
                </div>
              )}
              <div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {t("description")}
                </div>
                {(() => {
                  const steps = localizeInstructions(
                    selected.name,
                    selected.instructions,
                    lang,
                  );
                  if (!steps || steps.length === 0)
                    return <p className="text-sm">{t("noDescription")}</p>;
                  return (
                    <ol className="list-decimal list-inside text-sm space-y-1.5 marker:text-slate-400">
                      {steps.map((step, i) => (
                        <li key={i} className="leading-relaxed">{step}</li>
                      ))}
                    </ol>
                  );
                })()}
              </div>
              <div className="pt-2 flex gap-2">
                <Link
                  href={`/workouts/new?add=${selected.id}`}
                  className="flex-1 text-center px-4 py-2 rounded-full bg-brand-600 text-white hover:bg-brand-700"
                >
                  {t("addToWorkout")}
                </Link>
                <button
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700"
                >
                  {t("back")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
