// Profile management.
//
// "Profiles" are pure-localStorage namespaces — there is NO server-side
// authentication, no email verification, no password. An email is just a
// stable name a user picks so their workouts/history are isolated from any
// other person who shares the device.
//
// Why this approach: the app's design promise is "no login, no backend".
// We honor that by keeping every byte of user data in localStorage; the email
// is only used as a partition key. Switching profiles = switching the active
// namespace.

import type { Lang } from "./types";

// ---- key constants (global, NOT namespaced) ----
const KEY_PROFILES = "mwc.profiles.v1";
const KEY_ACTIVE = "mwc.profile.active.v1";
const KEY_MIGRATED = "mwc.profile.migrated.v1";

// Original (un-namespaced) keys that pre-date the profile system. We migrate
// these into the first profile's namespace on signup.
export const LEGACY_KEYS = [
  "mwc.workouts.v1",
  "mwc.history.v1",
  "mwc.settings.v1",
] as const;

export interface Profile {
  email: string; // normalized: lowercased + trimmed
  createdAt: string; // ISO timestamp
  lang?: Lang; // remembered last-used language per profile (optional)
}

// ---- email helpers ----

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string {
  return (input ?? "").trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  const e = normalizeEmail(input);
  return EMAIL_RE.test(e) && e.length <= 254;
}

// ---- safe storage helpers (SSR-safe) ----

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota — swallow */
  }
}

// ---- profile list ----

export function getProfiles(): Profile[] {
  return safeGet<Profile[]>(KEY_PROFILES, []);
}

function saveProfiles(list: Profile[]): void {
  safeSet(KEY_PROFILES, list);
}

export function getProfile(email: string): Profile | undefined {
  const e = normalizeEmail(email);
  return getProfiles().find((p) => p.email === e);
}

// Idempotent. Returns the existing profile if already registered, otherwise
// appends a new one.
export function upsertProfile(email: string): Profile {
  const e = normalizeEmail(email);
  const list = getProfiles();
  const existing = list.find((p) => p.email === e);
  if (existing) return existing;
  const fresh: Profile = { email: e, createdAt: new Date().toISOString() };
  list.push(fresh);
  saveProfiles(list);
  return fresh;
}

export function removeProfile(email: string): void {
  const e = normalizeEmail(email);
  saveProfiles(getProfiles().filter((p) => p.email !== e));
  if (getActiveEmail() === e) clearActiveEmail();
  // Sweep this profile's namespaced data.
  if (typeof window === "undefined") return;
  const suffix = `::${e}`;
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.endsWith(suffix)) toRemove.push(k);
  }
  for (const k of toRemove) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* swallow */
    }
  }
}

// ---- active profile ----

export function getActiveEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY_ACTIVE);
  } catch {
    return null;
  }
}

export function setActiveEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_ACTIVE, normalizeEmail(email));
  } catch {
    /* swallow */
  }
}

export function clearActiveEmail(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_ACTIVE);
  } catch {
    /* swallow */
  }
}

// ---- key namespacing ----

/**
 * Given a base key like "mwc.workouts.v1", return the namespaced variant
 * for the currently active profile (e.g. "mwc.workouts.v1::alice@x.com").
 *
 * If no profile is active (shouldn't happen in normal flow because the
 * ProfileGate blocks the app), we fall back to the legacy un-namespaced key
 * — that keeps tests / direct-localStorage usage from breaking.
 */
export function namespacedKey(base: string): string {
  const email = getActiveEmail();
  return email ? `${base}::${email}` : base;
}

// ---- one-shot migration ----

/**
 * Move legacy un-namespaced keys (workouts / history / settings written before
 * the profile system existed) into the given email's namespace.
 *
 * Only runs once per browser — guarded by KEY_MIGRATED. If the legacy keys
 * already happen to be empty, we still set the flag so we don't keep checking.
 */
export function migrateLegacyDataTo(email: string): {
  migratedKeys: string[];
} {
  if (typeof window === "undefined") return { migratedKeys: [] };
  const alreadyDone = safeGet<boolean>(KEY_MIGRATED, false);
  if (alreadyDone) return { migratedKeys: [] };

  const e = normalizeEmail(email);
  const migrated: string[] = [];
  for (const base of LEGACY_KEYS) {
    try {
      const raw = window.localStorage.getItem(base);
      if (raw == null) continue;
      const target = `${base}::${e}`;
      // Don't clobber data the user might already have in the new namespace
      // (extremely unlikely on first signup, but harmless to guard).
      if (window.localStorage.getItem(target) == null) {
        window.localStorage.setItem(target, raw);
        migrated.push(base);
      }
      window.localStorage.removeItem(base);
    } catch {
      /* swallow */
    }
  }
  safeSet(KEY_MIGRATED, true);
  return { migratedKeys: migrated };
}

// ---- combined "sign in" helper ----

/**
 * Idempotent: create-or-fetch the profile, mark it active, run legacy
 * migration if this is the very first sign-in.
 * Returns whether the legacy data was migrated into this profile (used to
 * show the user a one-time "we kept your previous data" notice).
 */
export function signIn(rawEmail: string): {
  profile: Profile;
  migrated: boolean;
} {
  if (!isValidEmail(rawEmail)) {
    throw new Error("invalid_email");
  }
  const profile = upsertProfile(rawEmail);
  setActiveEmail(profile.email);
  const { migratedKeys } = migrateLegacyDataTo(profile.email);
  return { profile, migrated: migratedKeys.length > 0 };
}

export function signOut(): void {
  clearActiveEmail();
}
