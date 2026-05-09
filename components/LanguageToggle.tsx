"use client";

import { useLang } from "./LangProvider";

export default function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex rounded-full border border-slate-300 dark:border-slate-700 overflow-hidden text-xs font-medium">
      <button
        onClick={() => setLang("zh")}
        className={`px-3 py-1 transition ${
          lang === "zh"
            ? "bg-brand-600 text-white"
            : "bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        中文
      </button>
      <button
        onClick={() => setLang("en")}
        className={`px-3 py-1 transition ${
          lang === "en"
            ? "bg-brand-600 text-white"
            : "bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        EN
      </button>
    </div>
  );
}
