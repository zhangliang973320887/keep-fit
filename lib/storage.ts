// User data (workouts / history / settings) now lives on the Go backend,
// accessed via fetch + httpOnly auth cookie. All these helpers are async.
//
// Language preference stays in localStorage — it's a per-device UI choice,
// not personal data, and would be jarring if it changed every time you log
// in on a different device.

import type { AppSettings, HistoryEntry, Lang, Workout } from "./types";
import { api } from "./api";

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

// ---- Workouts -------------------------------------------------------------

export async function getWorkouts(): Promise<Workout[]> {
  return await api.get<Workout[]>("/api/workouts");
}

export async function getWorkout(id: string): Promise<Workout | undefined> {
  // The backend doesn't expose a single-workout endpoint (kept the API small);
  // we filter client-side. The full list is paginated nowhere yet so this is fine.
  const all = await getWorkouts();
  return all.find((w) => w.id === id);
}

export async function saveWorkout(workout: Workout): Promise<Workout> {
  // The handler accepts both POST /api/workouts and PUT /api/workouts/:id
  // and behaves the same — upsert by (user_id, client_id).
  return await api.post<Workout>("/api/workouts", workout);
}

export async function deleteWorkout(id: string): Promise<void> {
  await api.del(`/api/workouts/${encodeURIComponent(id)}`);
}

// ---- History --------------------------------------------------------------

export async function getHistory(): Promise<HistoryEntry[]> {
  return await api.get<HistoryEntry[]>("/api/history");
}

export async function appendHistory(entry: HistoryEntry): Promise<void> {
  await api.post("/api/history", entry);
}

export async function clearHistory(): Promise<void> {
  await api.del("/api/history");
}

// ---- Settings -------------------------------------------------------------

export async function getSettings(): Promise<AppSettings> {
  const raw = await api.get<Partial<AppSettings>>("/api/settings");
  return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await api.put("/api/settings", s);
}

// ---- Language (kept local — per-device UI preference) ---------------------

export function getLang(): Lang {
  if (typeof window === "undefined") return "zh";
  try {
    const raw = window.localStorage.getItem(KEY_LANG);
    return raw ? (JSON.parse(raw) as Lang) : "zh";
  } catch {
    return "zh";
  }
}

export function setLang(lang: Lang): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_LANG, JSON.stringify(lang));
  } catch {
    /* swallow */
  }
}

// ---- Util -----------------------------------------------------------------

export function uid(): string {
  // RFC4122-ish lightweight ID — used as the stable client_id for syncing
  // a workout to the backend across edit + create.
  return "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
