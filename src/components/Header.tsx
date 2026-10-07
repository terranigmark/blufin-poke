"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import s from "./Header.module.css";

/** Clicking "Arma tu poke" while already in the builder sends it back to the intro. */
export const BUILD_RESET_EVENT = "blufin:build-reset";

export function Header() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // The open menu covers the screen: lock page scroll and let Escape close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
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
        <Link href="/" className={s.logo} onClick={close} aria-label="Blufin Poke Co · Inicio">
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
          <Link href="/menu">Menú</Link>
          <Link href="/#nosotros">Nosotros</Link>
          <Link href="/#ubicacion">Ubicación</Link>
          <Link href="/arma-tu-poke" className={s.cta} onClick={goBuild}>
            Arma tu poke →
          </Link>
        </nav>

        <button className={s.burger} aria-label={open ? "Cerrar menú" : "Menú"} aria-expanded={open} onClick={() => setOpen(!open)}>
          <span />
          <span />
          <span />
        </button>
      </div>

      {open && (
        <nav className={s.mobileNav}>
          <Link href="/arma-tu-poke" onClick={goBuild}>
            Arma tu poke
          </Link>
          <Link href="/menu" onClick={close}>
            Menú
          </Link>
          <Link href="/#nosotros" onClick={close}>
            Nosotros
          </Link>
          <Link href="/#ubicacion" onClick={close}>
            Ubicación
          </Link>
        </nav>
      )}
    </header>
  );
}
