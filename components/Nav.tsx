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
function ProfileMenu() {
  const { t } = useLang();
  const { profile, signOut, deleteAccount, ready } = useProfile();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!ready || !profile) return null;

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
        <Avatar email={profile.email} size={28} />
        <span className="hidden sm:inline text-xs text-slate-600 dark:text-slate-300 max-w-[140px] truncate">
          {profile.email}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden z-50"
        >
          <div className="p-3 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
            <Avatar email={profile.email} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500">{t("profileActiveLabel")}</div>
              <div className="text-sm font-medium truncate">{profile.email}</div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                setOpen(false);
              }}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"
              role="menuitem"
            >
              {t("profileSignOut")}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm(t("profileDeleteConfirm"))) {
                  await deleteAccount();
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
