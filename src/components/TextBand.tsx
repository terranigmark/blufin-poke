"use client";

import { useEffect, useRef } from "react";
import { useLanding } from "@/lib/api";
import { useT } from "@/lib/i18n";
import s from "./TextBand.module.css";

// Two rows of big brand words that slide apart only while the page scrolls.
// Decorative (the hero already says all of it), so screen readers skip it.
// Still under prefers-reduced-motion.
export function TextBand() {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      // 0 as the band enters at the bottom, 1 as it leaves at the top.
      const p = (window.innerHeight - r.top) / (window.innerHeight + r.height);
      el.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const words = useLanding().belt.words.map((w) => t(w.text, w.text_en));
  if (!words.length) return null;
  const row = Array(4).fill(words).flat().join("  •  ");
  return (
    <div ref={ref} className={s.band} aria-hidden="true" data-testid="text-band">
      <div className={s.row}>{row}</div>
      <div className={`${s.row} ${s.outline}`}>{row}</div>
    </div>
  );
}
