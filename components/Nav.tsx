"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "./LangProvider";
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
      </div>
    </header>
  );
}
