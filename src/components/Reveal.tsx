"use client";

import { useEffect } from "react";

// Fades in [data-reveal] blocks as they scroll into view. Only blocks that start
// below the fold get hidden, so nothing visible on load ever flickers, and the
// page stays fully readable without JS. Motion is off under prefers-reduced-motion (CSS).
export function Reveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.remove("reveal-hidden");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add("reveal-hidden");
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return null;
}
