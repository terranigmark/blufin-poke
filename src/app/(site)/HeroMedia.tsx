"use client";

import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "@/lib/api";
import { useT } from "@/lib/i18n";
import s from "./home.module.css";

// Muted, looping background clip with a parallax drift. The picture shows while it
// loads, and is all that shows under prefers-reduced-motion. Either can be left empty in /admin.
export function HeroMedia({ image, video }: { image: string; video: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState(false);
  const t = useT();

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
      {image && <img src={mediaUrl(image)} alt={t("Olas al atardecer en la playa", "Waves at sunset on the beach")} className={s.heroImg} fetchPriority="high" />}
      {motion && video && (
        <video key={video} className={s.heroImg} src={mediaUrl(video)} poster={image ? mediaUrl(image) : undefined} autoPlay muted loop playsInline aria-hidden="true" />
      )}
    </div>
  );
}
