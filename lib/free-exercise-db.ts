// Client over yuhonas/free-exercise-db (https://github.com/yuhonas/free-exercise-db).
// Single static JSON of 873 exercises, every one has 2 illustration images.
// Served via jsDelivr CDN — no auth, no rate limits in practice.
import type { Exercise } from "./types";

const DATA_URL =
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json";
const IMG_BASE =
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";
const CACHE_KEY = "mwc.exercises.cache.v4";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface RawExercise {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

interface CachePayload {
  fetchedAt: number;
  exercises: Exercise[];
}

function readCache(): CachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(exercises: Exercise[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: CachePayload = { fetchedAt: Date.now(), exercises };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage quota — ignore, we'll refetch next time
  }
}

// "chest" → primary filter "category" used by the UI's 部位 dropdown.
// We use primaryMuscles[0] as the category so users can filter by body part,
// since the dataset's own `category` field is movement-type (strength/cardio/...).
function deriveCategory(raw: RawExercise): string {
  return raw.primaryMuscles?.[0] ?? raw.category ?? "other";
}

function normalize(raw: RawExercise): Exercise {
  const images = (raw.images || []).map((p) => IMG_BASE + p);
  return {
    id: raw.id,
    name: raw.name,
    instructions: raw.instructions ?? [],
    category: deriveCategory(raw),
    type: raw.category ?? "",
    level: raw.level ?? "",
    mechanic: raw.mechanic ?? null,
    force: raw.force ?? null,
    muscles: raw.primaryMuscles ?? [],
    musclesSecondary: raw.secondaryMuscles ?? [],
    equipment: raw.equipment ? [raw.equipment] : [],
    imageUrl: images[0] ?? null,
    imageUrls: images,
  };
}

export async function loadExercises(forceRefresh = false): Promise<Exercise[]> {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return cached.exercises;
  }
  const res = await fetch(DATA_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`free-exercise-db ${res.status}: ${res.statusText}`);
  const raw = (await res.json()) as RawExercise[];
  const normalized = raw.map(normalize);
  normalized.sort((a, b) => a.name.localeCompare(b.name));
  writeCache(normalized);
  return normalized;
}

export function getCacheTimestamp(): number | null {
  return readCache()?.fetchedAt ?? null;
}
