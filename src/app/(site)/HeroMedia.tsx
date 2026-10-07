"use client";

import { useEffect, useRef, useState } from "react";
import s from "./home.module.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const VIDEO = `${BASE}/video/hero.mp4`;
const POSTER = `${BASE}/video/hero-poster.jpg`;

// Muted, looping background clip with a parallax drift. The poster (the clip's first
// frame) shows while it loads, and is all that shows under prefers-reduced-motion.
export function HeroMedia() {
  const wrap = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setMotion(true);

    // Parallax: the media drifts down at 40% of the scroll speed while the hero is on screen.
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (wrap.current && y < window.innerHeight * 1.2) wrap.current.style.transform = `translate3d(0, ${y * 0.4}px, 0)`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div ref={wrap} className={s.heroMedia}>
      <img src={POSTER} alt="Olas al atardecer en la playa" className={s.heroImg} fetchPriority="high" />
      {motion && (
        <video className={s.heroImg} src={VIDEO} poster={POSTER} autoPlay muted loop playsInline aria-hidden="true" />
      )}
    </div>
  );
}
