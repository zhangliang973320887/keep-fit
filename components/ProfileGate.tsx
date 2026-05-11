"use client";

// Blocks app render until a profile is active. Renders an email-entry screen
// (with one-click switch to any previously-used email) when no one is signed
// in. The first-ever signin will migrate legacy un-namespaced localStorage
// data into that profile (`signIn` in profile.ts handles it transparently).

import { useState, type ReactNode } from "react";
import { useLang } from "./LangProvider";
import { useProfile } from "./ProfileProvider";
import { isValidEmail, normalizeEmail } from "@/lib/profile";

export default function ProfileGate({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const { ready, activeEmail, profiles, signIn } = useProfile();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Pre-hydration: just render the children — they'll get a placeholder
  // (most pages call storage helpers inside useEffect, which only runs after
  // hydration anyway). This avoids SSR mismatch + a flash of the login screen.
  // Before hydration we don't know who's signed in — just render children
  // so server-rendered HTML matches. The page-level effects only read
  // storage after mount, so they'll naturally pick up the active email then.
  if (!ready) return <>{children}</>;

  // Signed in — render children with a key tied to the email, so any page
  // that reads storage in a [] dep useEffect still refreshes on switch
  // (React unmounts/remounts the subtree when the key changes).
  if (activeEmail) return <div key={activeEmail}>{children}</div>;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim();
    if (!isValidEmail(v)) {
      setError(t("authInvalidEmail"));
      return;
    }
    setError(null);
    signIn(v);
    setEmail("");
  }

  function switchTo(em: string) {
    signIn(em);
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
            {t("authSubtitle")}
          </p>
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
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="you@example.com"
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 outline-none transition focus:ring-2 focus:ring-brand-500/40 ${
                error
                  ? "border-rose-400"
                  : "border-slate-200 dark:border-slate-800 focus:border-brand-500"
              }`}
            />
            {error && (
              <p className="mt-1.5 text-xs text-rose-500">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 transition shadow-sm"
          >
            {t("authContinue")}
          </button>
        </form>

        {profiles.length > 0 && (
          <div className="mt-7">
            <div className="text-xs text-slate-500 mb-2 px-1">
              {t("authRecent")}
            </div>
            <ul className="space-y-1.5">
              {profiles.map((p) => (
                <li key={p.email}>
                  <button
                    type="button"
                    onClick={() => switchTo(p.email)}
                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 hover:border-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-left"
                  >
                    <Avatar email={p.email} />
                    <span className="flex-1 text-sm truncate">{p.email}</span>
                    <span className="text-xs text-slate-400">→</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-7 text-center text-xs text-slate-400 leading-relaxed px-3">
          {t("authNoBackendNote")}
        </p>
      </div>
    </div>
  );
}

// Tiny gradient initials avatar — used here and re-exported for Nav.
export function Avatar({
  email,
  size = 28,
}: {
  email: string;
  size?: number;
}) {
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
