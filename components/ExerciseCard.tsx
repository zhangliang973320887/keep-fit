"use client";

import type { Exercise } from "@/lib/types";
import { useLang } from "./LangProvider";
import {
  localizeCategory,
  localizeEquipmentList,
  localizeMuscleList,
  localizeName,
} from "@/lib/exercise-translations";

interface Props {
  exercise: Exercise;
  onClick?: (e: Exercise) => void;
  selected?: boolean;
  rightSlot?: React.ReactNode;
}

export default function ExerciseCard({ exercise, onClick, selected, rightSlot }: Props) {
  const { t, lang } = useLang();
  const name = localizeName(exercise.name, lang);
  const category = localizeCategory(exercise.category, lang);
  const muscles = localizeMuscleList(exercise.muscles, lang);
  const equipment = localizeEquipmentList(exercise.equipment, lang);
  return (
    <button
      type="button"
      onClick={() => onClick?.(exercise)}
      className={`text-left w-full rounded-2xl border bg-white dark:bg-slate-900 transition overflow-hidden ${
        selected
          ? "border-brand-500 ring-2 ring-brand-500/30"
          : "border-slate-200 dark:border-slate-800 hover:border-brand-500"
      }`}
    >
      <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
        {exercise.imageUrl ? (
          // wger sometimes serves gifs; <img> handles them better than next/image
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exercise.imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-4xl opacity-40">🏋️</span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium leading-tight line-clamp-2">{name}</div>
          {rightSlot}
        </div>
        <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-2 gap-y-0.5">
          <span>{category}</span>
          {(() => {
            // Dedup: don't repeat the category if it already equals the first muscle.
            const extra = muscles.filter((m) => m !== category).slice(0, 2);
            return extra.length > 0 ? (
              <span title={t("primaryMuscles")}>· {extra.join(", ")}</span>
            ) : null;
          })()}
          {equipment.length > 0 && (
            <span title={t("equipment")}>· {equipment.slice(0, 2).join(", ")}</span>
          )}
        </div>
      </div>
    </button>
  );
}
