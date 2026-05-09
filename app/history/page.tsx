"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { clearHistory, getHistory } from "@/lib/storage";
import type { HistoryEntry } from "@/lib/types";
import { localizeName } from "@/lib/exercise-translations";

// fmtDuration is built inside the component so it can use the t() helper.

function startOfWeek(d = new Date()): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday-start
  date.setDate(date.getDate() + diff);
  return date;
}

export default function HistoryPage() {
  const { t, lang } = useLang();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const fmtDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return t("unitSeconds", { n: s });
    return t("unitMinSec", { m, s });
  };

  const stats = useMemo(() => {
    const totalSec = history.reduce((s, h) => s + h.durationSeconds, 0);
    const weekStart = startOfWeek().getTime();
    const thisWeek = history.filter((h) => new Date(h.completedAt).getTime() >= weekStart).length;
    return {
      total: history.length,
      totalMinutes: Math.round(totalSec / 60),
      thisWeek,
    };
  }, [history]);

  const onClear = () => {
    if (!confirm(t("confirmClearHistory"))) return;
    clearHistory();
    setHistory([]);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("historyTitle")}</h1>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="text-sm px-3 py-1.5 rounded-full border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            {t("clearHistory")}
          </button>
        )}
      </div>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500">{t("totalSessions")}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold">{stats.total}</span>
            {t("unitTimes") && (
              <span className="text-sm text-slate-500">{t("unitTimes")}</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500">{t("totalMinutes")}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold">{stats.totalMinutes}</span>
            <span className="text-sm text-slate-500">{t("unitMin")}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500">{t("thisWeek")}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold">{stats.thisWeek}</span>
            {t("unitTimes") && (
              <span className="text-sm text-slate-500">{t("unitTimes")}</span>
            )}
          </div>
        </div>
      </section>

      {history.length === 0 ? (
        <p className="text-slate-500 py-12 text-center">{t("noHistory")}</p>
      ) : (
        <ul className="space-y-2">
          {history.map((h) => (
            <li
              key={h.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{h.workoutName}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(h.completedAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm font-mono">{fmtDuration(h.durationSeconds)}</div>
              </div>
              {h.completedSets.length > 0 && (
                <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs text-slate-600 dark:text-slate-400">
                  {h.completedSets.map((c, i) => (
                    <li key={i} className="truncate">
                      • {localizeName(c.exerciseName, lang)} × {c.sets}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
