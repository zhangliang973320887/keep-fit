// Tiny localStorage wrapper. SSR-safe (returns null/falls back when window is undefined).
//
// User-data keys (workouts, history, settings) are namespaced per profile via
// `namespacedKey()` from `./profile`. Language is global (browser-level UI
// preference, not personal data).
import type { AppSettings, HistoryEntry, Lang, Workout } from "./types";
import { namespacedKey } from "./profile";

// Base keys — passed through namespacedKey() to get the active profile's namespace.
const BASE_WORKOUTS = "mwc.workouts.v1";
const BASE_HISTORY = "mwc.history.v1";
const BASE_SETTINGS = "mwc.settings.v1";

// Truly global keys (not per-profile):
const KEY_LANG = "mwc.lang.v1";

const DEFAULT_SETTINGS: AppSettings = {
  voiceEnabled: true,
  beatEnabled: false,
  voiceControlEnabled: false,
  prepareSeconds: 10,
  soundPackId: "gym",
  videoEnabled: true,
  videoSpeedMultiplier: 1.0,
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
  return safeGet<Workout[]>(namespacedKey(BASE_WORKOUTS), []);
}

export function getWorkout(id: string): Workout | undefined {
  return getWorkouts().find((w) => w.id === id);
}

export function saveWorkout(workout: Workout): void {
  const all = getWorkouts();
  const idx = all.findIndex((w) => w.id === workout.id);
  if (idx >= 0) all[idx] = workout;
  else all.unshift(workout);
  safeSet(namespacedKey(BASE_WORKOUTS), all);
}

export function deleteWorkout(id: string): void {
  safeSet(
    namespacedKey(BASE_WORKOUTS),
    getWorkouts().filter((w) => w.id !== id),
  );
}

// History
export function getHistory(): HistoryEntry[] {
  return safeGet<HistoryEntry[]>(namespacedKey(BASE_HISTORY), []);
}

export function appendHistory(entry: HistoryEntry): void {
  const all = getHistory();
  all.unshift(entry);
  safeSet(namespacedKey(BASE_HISTORY), all);
}

export function clearHistory(): void {
  safeSet(namespacedKey(BASE_HISTORY), []);
}

// Language (global — UI preference, not personal data)
export function getLang(): Lang {
  return safeGet<Lang>(KEY_LANG, "zh");
}

export function setLang(lang: Lang): void {
  safeSet(KEY_LANG, lang);
}

// Settings (per-profile)
export function getSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...safeGet<Partial<AppSettings>>(namespacedKey(BASE_SETTINGS), {}),
  };
}

export function saveSettings(s: AppSettings): void {
  safeSet(namespacedKey(BASE_SETTINGS), s);
}

// Util
export function uid(): string {
  // RFC4122-ish lightweight ID — fine for client-only data
  return "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
