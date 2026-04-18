import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type Lang } from "@/lib/i18n";

type LangState = { lang: Lang; setLang: (l: Lang) => void; t: (english: string) => string };

const LangCtx = createContext<LangState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("daak-lang") as Lang) || "en");

  useEffect(() => {
    localStorage.setItem("daak-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LangState>(
    () => ({ lang, setLang: setLangState, t: (en) => translate(lang, en) }),
    [lang],
  );
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

// t() for translating a source English string to the active language, falling back to English.
export function useT() {
  const v = useContext(LangCtx);
  if (!v) throw new Error("useT must be used inside LanguageProvider");
  return v;
}
