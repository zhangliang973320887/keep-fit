// Profile / auth — now backed by the Go backend.
//
// We keep the same exported names that the rest of the app already uses
// (`getActiveEmail`, `register`, `login`, etc.) but they now make HTTP calls
// instead of touching localStorage. Auth state lives in the httpOnly `kf_token`
// cookie that the backend sets; we never see the token in JS.
//
// The "active email" is what `/api/auth/me` returns. We cache it in
// React state via ProfileProvider; here we just expose the underlying
// fetch helpers.

import { api, ApiError } from "./api";

// Legacy localStorage keys that may still hold data from before the backend
// existed. On first successful sign-in we POST them to /api/migrate then wipe.
const LEGACY_KEYS = [
  "mwc.workouts.v1",
  "mwc.history.v1",
  "mwc.settings.v1",
] as const;
const LEGACY_PROFILES_KEY = "mwc.profiles.v2";
const LEGACY_ACTIVE_KEY = "mwc.profile.active.v1";
const MIGRATED_FLAG_KEY = "mwc.server_migrated.v1";

export interface Profile {
  email: string;
  createdAt: string;
}

// ---- email helpers (still used by the gate UI) ----

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export function normalizeEmail(input: string): string {
  return (input ?? "").trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  const e = normalizeEmail(input);
  return EMAIL_RE.test(e) && e.length <= 254;
}

export function isValidPassword(input: string): boolean {
  return typeof input === "string" && input.length >= MIN_PASSWORD_LENGTH;
}

// ---- /api/auth ----

export async function fetchMe(): Promise<Profile | null> {
  try {
    return await api.get<Profile>("/api/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export async function register(
  rawEmail: string,
  password: string,
): Promise<Profile> {
  if (!isValidEmail(rawEmail)) throw new ApiError(400, "invalid_email");
  if (!isValidPassword(password)) throw new ApiError(400, "weak_password");
  return api.post<Profile>("/api/auth/register", {
    email: normalizeEmail(rawEmail),
    password,
  });
}

export async function login(
  rawEmail: string,
  password: string,
): Promise<Profile> {
  return api.post<Profile>("/api/auth/login", {
    email: normalizeEmail(rawEmail),
    password,
  });
}

export async function signOut(): Promise<void> {
  try {
    await api.post("/api/auth/logout");
  } catch {
    /* server-side logout best-effort; cookie clearing might already be gone */
  }
}

export async function deleteAccount(): Promise<void> {
  await api.del("/api/auth/account");
}

// ---- one-shot localStorage → server migration ----

/**
 * If the browser has any leftover pre-backend localStorage data, POST it to
 * the server under the currently-authenticated user, then mark the migration
 * as done so it never runs again. Safe to call on every sign-in — it no-ops
 * once the flag is set.
 *
 * Returns the number of items uploaded (or null if nothing to do).
 */
export async function migrateLocalToServer(): Promise<{
  workouts: number;
  history: number;
  settings: number;
} | null> {
  if (typeof window === "undefined") return null;
  try {
    if (window.localStorage.getItem(MIGRATED_FLAG_KEY) === "1") return null;
  } catch {
    return null;
  }

  // Gather payload. We look for both un-namespaced keys (very old) and
  // namespaced keys (the email::email variant we used briefly). For namespaced
  // ones we use whatever was active at the time as the source.
  const payload: {
    workouts?: any[];
    history?: any[];
    settings?: any;
  } = {};

  const readJSON = (k: string): any => {
    try {
      const raw = window.localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  // First try un-namespaced legacy
  const unnamespacedWorkouts = readJSON(LEGACY_KEYS[0]);
  const unnamespacedHistory = readJSON(LEGACY_KEYS[1]);
  const unnamespacedSettings = readJSON(LEGACY_KEYS[2]);
  if (unnamespacedWorkouts) payload.workouts = unnamespacedWorkouts;
  if (unnamespacedHistory) payload.history = unnamespacedHistory;
  if (unnamespacedSettings) payload.settings = unnamespacedSettings;

  // Then look for any namespaced data
  const activeEmail = window.localStorage.getItem(LEGACY_ACTIVE_KEY);
  if (activeEmail) {
    const w = readJSON(`${LEGACY_KEYS[0]}::${activeEmail}`);
    const h = readJSON(`${LEGACY_KEYS[1]}::${activeEmail}`);
    const s = readJSON(`${LEGACY_KEYS[2]}::${activeEmail}`);
    if (w && !payload.workouts) payload.workouts = w;
    if (h && !payload.history) payload.history = h;
    if (s && !payload.settings) payload.settings = s;
  }

  // Reshape workouts/history to match server's DTO (`id` field instead of `clientId`).
  // The frontend already uses `.id`, so it lines up — but legacy shapes might be
  // bare so we don't transform here; the server skips malformed entries.

  if (!payload.workouts && !payload.history && !payload.settings) {
    try {
      window.localStorage.setItem(MIGRATED_FLAG_KEY, "1");
    } catch { /* swallow */ }
    return null;
  }

  let result: { workouts: number; history: number; settings: number };
  try {
    result = await api.post<{ workouts: number; history: number; settings: number }>(
      "/api/migrate",
      payload,
    );
  } catch {
    // Don't mark migrated — let it retry next session
    return null;
  }

  // Success — wipe legacy keys so they don't get re-uploaded later
  try {
    for (const k of LEGACY_KEYS) {
      window.localStorage.removeItem(k);
      if (activeEmail) window.localStorage.removeItem(`${k}::${activeEmail}`);
    }
    window.localStorage.removeItem(LEGACY_PROFILES_KEY);
    window.localStorage.removeItem(LEGACY_ACTIVE_KEY);
    window.localStorage.removeItem("mwc.profiles.v1");
    window.localStorage.removeItem("mwc.profile.migrated.v1");
    window.localStorage.setItem(MIGRATED_FLAG_KEY, "1");
  } catch {
    /* swallow */
  }

  return result;
}
