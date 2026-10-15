"use client";

// Spanish/English for the public site. The visitor's device language decides on the
// first visit (Spanish unless it prefers English); the header toggle overrides it and
// is remembered on that device. Same URLs for both languages.

import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "es" | "en";
const KEY = "blufin.lang";

/** The saved choice, else the first Spanish or English entry in the device languages, else Spanish. */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "es" || saved === "en") return saved;
  } catch {}
  const first = (navigator.languages?.length ? navigator.languages : [navigator.language]).find((l) => /^(es|en)\b/i.test(l ?? ""));
  return first?.toLowerCase().startsWith("en") ? "en" : "es";
}

/** `t("Hola", "Hello")`: the text for the current language; English falls back to Spanish when empty. */
export const pick =
  (lang: Lang) =>
  (es: string, en?: string | null): string =>
    lang === "en" && en ? en : es;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "es", setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Starts in Spanish to match the static HTML, then switches once the device is known.
  const [lang, setLangState] = useState<Lang>("es");
  useEffect(() => setLangState(detectLang()), []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
export const useT = () => pick(useLang().lang);
