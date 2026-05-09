"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "@/lib/types";
import { getLang, setLang as persistLang } from "@/lib/storage";
import { t as translate, type TKey } from "@/lib/i18n";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<Ctx>({
  lang: "zh",
  setLang: () => {},
  t: (k) => k,
});

export function LangProvider({ children }: { children: ReactNode }) {
  // Default to "zh" on the server. Hydrate from localStorage in effect to avoid SSR mismatch.
  const [lang, setLangState] = useState<Lang>("zh");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLangState(getLang());
    setHydrated(true);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    persistLang(l);
  };

  const t = (key: TKey, vars?: Record<string, string | number>) => translate(key, lang, vars);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {/* suppressHydrationWarning on the wrapper avoids transient mismatches before hydration */}
      <div suppressHydrationWarning>{hydrated ? children : children}</div>
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
