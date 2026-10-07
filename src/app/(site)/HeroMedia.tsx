"use client";

import { useEffect, useRef, useState } from "react";
import { PHOTOS } from "@/data/menu";
import s from "./home.module.css";

// Muted background clip, 25:00–26:00 of the video. Looped by seeking back just before
// END ourselves: letting YouTube reach the end pauses the player and flashes its icon.
const VIDEO = "hw32XIVdHCU";
const START = 1500;
const END = 1560;

// The photo is the poster: it stays until the clip is actually playing, and is all
// that shows under prefers-reduced-motion or if the browser blocks autoplay.
export function HeroMedia() {
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [motion, setMotion] = useState(false);
  const [playing, setPlaying] = useState(false);

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

    // YouTube iframe API over postMessage. YouTube's own play/pause icon can't be turned
    // off, so the video is only shown once it has been playing for a second (past the
    // icon's flash) and is hidden again, back to the photo, whenever it isn't playing.
    // A self-hosted <video> is the only way to drop the icon entirely.
    const send = (msg: object) => frame.current?.contentWindow?.postMessage(JSON.stringify(msg), "*");
    let showTimer = 0;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== "string") return;
      let info: { playerState?: number; currentTime?: number } | undefined;
      try {
        info = JSON.parse(e.data)?.info;
      } catch {
        return;
      }
      if (!info) return;
      if (info.playerState === 1) {
        clearTimeout(showTimer);
        showTimer = window.setTimeout(() => setPlaying(true), 1000);
      } else if (info.playerState !== undefined) {
        clearTimeout(showTimer);
        setPlaying(false);
      }
      if (info.currentTime !== undefined && info.currentTime >= END - 0.4) {
        send({ event: "command", func: "seekTo", args: [START, true] });
      }
    };
    window.addEventListener("message", onMessage);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(showTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const src =
    `https://www.youtube-nocookie.com/embed/${VIDEO}?start=${START}` +
    "&autoplay=1&mute=1&controls=0&playsinline=1&rel=0&disablekb=1&iv_load_policy=3&enablejsapi=1";

  return (
    <div ref={wrap} className={s.heroMedia}>
      <img src={PHOTOS.heroSunset} alt="Atardecer sobre el mar de Cortés" className={s.heroImg} fetchPriority="high" />
      {motion && (
        <iframe
          ref={frame}
          src={src}
          title="Video de fondo"
          aria-hidden="true"
          tabIndex={-1}
          allow="autoplay; encrypted-media"
          className={`${s.heroVideo} ${playing ? s.heroVideoOn : ""}`}
          onLoad={() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening" }), "*")}
        />
      )}
    </div>
  );
}
