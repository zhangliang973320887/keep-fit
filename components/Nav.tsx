"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLang } from "./LangProvider";
import { useProfile } from "./ProfileProvider";
import { Avatar } from "./ProfileGate";
import LanguageToggle from "./LanguageToggle";

const links = [
  { href: "/", key: "navHome" as const },
  { href: "/exercises", key: "navExercises" as const },
  { href: "/workouts", key: "navWorkouts" as const },
  { href: "/history", key: "navHistory" as const },
];

export default function Nav() {
  const pathname = usePathname();
  const { t } = useLang();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2">
        <Link href="/" className="font-semibold text-brand-600 mr-3">
          {t("appName")}
        </Link>
        <nav className="flex-1 flex items-center gap-1 overflow-x-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
                isActive(l.href)
                  ? "bg-brand-100 text-brand-700 dark:bg-brand-700/30 dark:text-brand-100"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>
        <LanguageToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Profile chip + dropdown — only renders when a profile is active.
function ProfileMenu() {
  const { t } = useLang();
  const { activeEmail, profiles, signIn, signOut, deleteProfile, ready } =
    useProfile();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setAdding(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!ready || !activeEmail) return null;

  const others = profiles.filter((p) => p.email !== activeEmail);

  function onAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      signIn(draft);
      setDraft("");
      setAdding(false);
      setOpen(false);
    } catch {
      setErr(t("authInvalidEmail"));
    }
  }

  return (
    <div ref={rootRef} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition p-1 pr-2.5"
        aria-label={t("profileMenuLabel")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar email={activeEmail} size={28} />
        <span className="hidden sm:inline text-xs text-slate-600 dark:text-slate-300 max-w-[140px] truncate">
          {activeEmail}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden z-50"
        >
          <div className="p-3 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
            <Avatar email={activeEmail} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500">
                {t("profileActiveLabel")}
              </div>
              <div className="text-sm font-medium truncate">{activeEmail}</div>
            </div>
          </div>

          {others.length > 0 && !adding && (
            <div className="py-1">
              <div className="px-3 pt-2 pb-1 text-xs text-slate-500">
                {t("profileSwitchTo")}
              </div>
              {others.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => {
                    signIn(p.email);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left"
                  role="menuitem"
                >
                  <Avatar email={p.email} size={24} />
                  <span className="text-sm truncate flex-1">{p.email}</span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 dark:border-slate-800">
            {adding ? (
              <form onSubmit={onAddSubmit} className="p-3 space-y-2">
                <input
                  type="email"
                  inputMode="email"
                  autoFocus
                  placeholder="email@example.com"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (err) setErr(null);
                  }}
                  className={`w-full rounded-lg border px-2.5 py-2 text-sm outline-none bg-white dark:bg-slate-900 ${
                    err
                      ? "border-rose-400"
                      : "border-slate-200 dark:border-slate-700 focus:border-brand-500"
                  }`}
                />
                {err && <p className="text-xs text-rose-500">{err}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setDraft("");
                      setErr(null);
                    }}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    {t("back")}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white py-1.5 text-sm font-medium"
                  >
                    {t("authContinue")}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-2"
                role="menuitem"
              >
                <span className="w-6 h-6 rounded-full border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400">
                  +
                </span>
                {t("profileAddAnother")}
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                signOut();
                setOpen(false);
              }}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"
              role="menuitem"
            >
              {t("profileSignOut")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("profileDeleteConfirm"))) {
                  deleteProfile(activeEmail!);
                  setOpen(false);
                }
              }}
              className="w-full px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              role="menuitem"
            >
              {t("profileDelete")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
