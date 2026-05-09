// Tiny localStorage wrapper. SSR-safe (returns null/falls back when window is undefined).
import type { AppSettings, HistoryEntry, Lang, Workout } from "./types";

const KEY_WORKOUTS = "mwc.workouts.v1";
const KEY_HISTORY = "mwc.history.v1";
const KEY_LANG = "mwc.lang.v1";
const KEY_SETTINGS = "mwc.settings.v1";

const DEFAULT_SETTINGS: AppSettings = {
  voiceEnabled: true,
  beatEnabled: false,
  voiceControlEnabled: false,
  prepareSeconds: 10,
  soundPackId: "gym",
};

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota or serialization failure — silently swallow
  }
}

// Workouts
export function getWorkouts(): Workout[] {
  return safeGet<Workout[]>(KEY_WORKOUTS, []);
}

export function getWorkout(id: string): Workout | undefined {
  return getWorkouts().find((w) => w.id === id);
}

export function saveWorkout(workout: Workout): void {
  const all = getWorkouts();
  const idx = all.findIndex((w) => w.id === workout.id);
  if (idx >= 0) all[idx] = workout;
  else all.unshift(workout);
  safeSet(KEY_WORKOUTS, all);
}

export function deleteWorkout(id: string): void {
  safeSet(
    KEY_WORKOUTS,
    getWorkouts().filter((w) => w.id !== id),
  );
}

// History
export function getHistory(): HistoryEntry[] {
  return safeGet<HistoryEntry[]>(KEY_HISTORY, []);
}

export function appendHistory(entry: HistoryEntry): void {
  const all = getHistory();
  all.unshift(entry);
  safeSet(KEY_HISTORY, all);
}

export function clearHistory(): void {
  safeSet(KEY_HISTORY, []);
}

// Language
export function getLang(): Lang {
  return safeGet<Lang>(KEY_LANG, "zh");
}

export function setLang(lang: Lang): void {
  safeSet(KEY_LANG, lang);
}

// Settings
export function getSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...safeGet<Partial<AppSettings>>(KEY_SETTINGS, {}) };
}

export function saveSettings(s: AppSettings): void {
  safeSet(KEY_SETTINGS, s);
}

// Util
export function uid(): string {
  // RFC4122-ish lightweight ID — fine for client-only data
  return "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
