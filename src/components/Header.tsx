"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { LangToggle } from "./LangToggle";
import s from "./Header.module.css";

/** Clicking "Arma tu poke" while already in the builder sends it back to the intro. */
export const BUILD_RESET_EVENT = "blufin:build-reset";

export function Header() {
  const t = useT();
  const [open, setOpen] = useState(false);
  // While closing, the menu stays mounted until its exit animation ends.
  const [closing, setClosing] = useState(false);
  const shown = open && !closing;
  const close = () => open && setClosing(true);
  const toggle = () => {
    if (shown) return close();
    setOpen(true);
    setClosing(false);
  };

  // The open menu covers the screen: lock page scroll and let Escape close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setClosing(true);
    document.documentElement.classList.add("nav-open");
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.classList.remove("nav-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const goBuild = () => {
    close();
    window.dispatchEvent(new Event(BUILD_RESET_EVENT));
  };

  return (
    <header className={s.header}>
      <div className={s.bar}>
        <Link href="/" className={s.logo} onClick={close} aria-label={t("Blufin Poke Co · Inicio", "Blufin Poke Co · Home")}>
          <span className={s.marlin}>
            <span>BLACK</span>
            <span>MARLIN</span>
            <span className={s.brewing}>BREWING</span>
          </span>
          <span className={s.divider} />
          <span className={s.wordmark}>
            <span className={s.blufin}>Blufin</span>
            <span className={s.pokeco}>
              <span className={s.rule} />
              POKE CO
              <span className={s.rule} />
            </span>
          </span>
        </Link>

        <nav className={s.desktopNav}>
          <Link href="/menu">{t("Menú", "Menu")}</Link>
          <Link href="/#nosotros">{t("Nosotros", "About")}</Link>
          <Link href="/#ubicacion">{t("Ubicación", "Location")}</Link>
          <Link href="/arma-tu-poke" className={s.cta} onClick={goBuild}>
            {t("Arma tu poke", "Build your poke")} →
          </Link>
        </nav>

        <LangToggle className={s.lang} />

        <button className={s.burger} aria-label={shown ? t("Cerrar menú", "Close menu") : t("Menú", "Menu")} aria-expanded={shown} onClick={toggle}>
          <span />
          <span />
          <span />
        </button>
      </div>

      {open && (
        <nav
          className={`${s.mobileNav} ${closing ? s.closing : ""}`}
          onAnimationEnd={(e) => {
            if (closing && e.target === e.currentTarget) {
              setOpen(false);
              setClosing(false);
            }
          }}
        >
          <Link href="/arma-tu-poke" onClick={goBuild}>
            {t("Arma tu poke", "Build your poke")}
          </Link>
          <Link href="/menu" onClick={close}>
            {t("Menú", "Menu")}
          </Link>
          <Link href="/#nosotros" onClick={close}>
            {t("Nosotros", "About")}
          </Link>
          <Link href="/#ubicacion" onClick={close}>
            {t("Ubicación", "Location")}
          </Link>
        </nav>
      )}
    </header>
  );
}
