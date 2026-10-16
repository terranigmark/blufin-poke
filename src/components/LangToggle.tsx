"use client";

import { useLang } from "@/lib/i18n";
import s from "./LangToggle.module.css";

/** The ES | EN switch in the site header and on the waiter ticket. */
export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`${s.toggle} ${className}`} role="group" aria-label={lang === "en" ? "Language" : "Idioma"}>
      {(["es", "en"] as const).map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)} aria-label={l === "es" ? "Español" : "English"}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
