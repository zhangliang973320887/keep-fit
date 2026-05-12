"use client";

// Blocks app render until the user is signed in.
//
// Two tabs: Sign in / Sign up. Backend is the source of truth — we don't
// have a "does this email exist" lookup (would leak account existence to
// strangers), so the user explicitly picks the action.
//
// On submit:
//   - sign in   → POST /api/auth/login   (sets JWT cookie)
//   - register  → POST /api/auth/register (also signs you in)
// Either path triggers the one-shot localStorage→server migration in
// ProfileProvider.

import { useState, type ReactNode } from "react";
import { useLang } from "./LangProvider";
import { useProfile } from "./ProfileProvider";
import { ApiError } from "@/lib/api";
import { isValidEmail, isValidPassword, normalizeEmail } from "@/lib/profile";

type Tab = "login" | "register";

export default function ProfileGate({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const { ready, profile, register, login } = useProfile();

  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Loading state while we probe /api/auth/me
  if (!ready) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-sm text-slate-400">{t("loading")}</div>
      </div>
    );
  }

  // Signed in — render the app, keyed by email so a profile switch unmounts/
  // remounts every page-level useEffect (re-fetching their data).
  if (profile) return <div key={profile.email}>{children}</div>;

  function mapError(e: unknown): string {
    if (e instanceof ApiError) {
      switch (e.code) {
        case "invalid_email": return t("authInvalidEmail");
        case "weak_password": return t("authPasswordTooShort");
        case "email_taken":   return t("authEmailTaken");
        case "wrong_credentials": return t("authWrongCredentials");
        default: return e.code;
      }
    }
    return String((e as any)?.message ?? "unknown");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setError(t("authInvalidEmail"));
      return;
    }
    if (!isValidPassword(password)) {
      setError(t("authPasswordTooShort"));
      return;
    }
    if (tab === "register" && password !== confirm) {
      setError(t("authPasswordMismatch"));
      return;
    }
    setBusy(true);
    try {
      if (tab === "register") {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(mapError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 text-white items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3.5 9v6" />
              <path d="M6.5 7v10" />
              <path d="M17.5 7v10" />
              <path d="M20.5 9v6" />
              <path d="M6.5 12h11" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            {t("authWelcome")}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
            {t("authSubtitleBackend")}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-5">
          <button
            type="button"
            onClick={() => { setTab("login"); setError(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              tab === "login"
                ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-100"
                : "text-slate-500"
            }`}
          >
            {t("authSignIn")}
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setError(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              tab === "register"
                ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-100"
                : "text-slate-500"
            }`}
          >
            {t("authSignUp")}
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              {t("authEmailLabel")}
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
              placeholder="you@example.com"
              className={fieldClass(false)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              {t("authPasswordLabel")}
            </label>
            <input
              type="password"
              autoComplete={tab === "register" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
              placeholder={tab === "register" ? "≥ 6" : ""}
              className={fieldClass(false)}
            />
          </div>
          {tab === "register" && (
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                {t("authPasswordConfirmLabel")}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); if (error) setError(null); }}
                className={fieldClass(!!error)}
              />
            </div>
          )}
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "…" : tab === "register" ? t("authSignUp") : t("authSignIn")}
          </button>
        </form>

        <p className="mt-7 text-center text-xs text-slate-400 leading-relaxed px-3">
          {t("authBackendNote")}
        </p>
      </div>
    </div>
  );
}

const primaryBtn =
  "w-full rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-2.5 transition shadow-sm";

function fieldClass(hasError: boolean): string {
  const base =
    "w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 outline-none transition focus:ring-2 focus:ring-brand-500/40";
  return hasError
    ? `${base} border-rose-400`
    : `${base} border-slate-200 dark:border-slate-800 focus:border-brand-500`;
}

// Re-export Avatar for Nav.
export function Avatar({ email, size = 28 }: { email: string; size?: number }) {
  const initial = (normalizeEmail(email)[0] ?? "?").toUpperCase();
  const hue = hashHue(email);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${(hue + 30) % 360},65%,45%))`,
        fontSize: Math.max(11, Math.round(size * 0.45)),
      }}
      className="rounded-full text-white font-semibold flex items-center justify-center shrink-0"
      aria-hidden
    >
      {initial}
    </div>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}
