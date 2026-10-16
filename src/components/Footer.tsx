"use client";

import { NETWORKS, type Network } from "@/data/landing";
import { useLanding } from "@/lib/api";
import { useT } from "@/lib/i18n";
import s from "./Footer.module.css";

// One icon per network /admin offers (Lucide-style strokes, brand marks filled).
const ICONS: Record<Network, React.ReactNode> = {
  instagram: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  facebook: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V10.5H7.8v3h2.6V21h3.1z" />
    </svg>
  ),
  tiktok: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.6 3c.4 2.2 1.8 3.6 4 3.8v3.1c-1.5.1-2.9-.4-4-1.2v6.1c0 3.4-2.7 5.9-5.9 5.9S4.8 18.2 4.8 15c0-3.5 3.1-6.2 6.7-5.8v3.2c-1.7-.4-3.5.8-3.5 2.6 0 1.5 1.2 2.7 2.7 2.7s2.7-1.2 2.7-2.9V3h3.2z" />
    </svg>
  ),
  x: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3zm-1.08 16.2h1.7L7.4 4.73H5.58l11.09 14.47z" />
    </svg>
  ),
  youtube: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
    </svg>
  ),
  whatsapp: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M3.5 20.5l1.3-4A8.5 8.5 0 1 1 8 19.6z" />
      <path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z" fill="currentColor" strokeWidth="1" />
    </svg>
  ),
};

export function Footer({ className = "" }: { className?: string }) {
  const t = useT();
  const f = useLanding().footer;
  return (
    <footer className={`${s.footer} ${className}`}>
      <div className={s.inner}>
        <span className={s.blufin}>{f.brand}</span>
        <span className={s.brands}>{t(f.tagline, f.tagline_en)}</span>
        <span className={s.city}>{f.city}</span>
        {f.social.length > 0 && (
          <div className={s.social}>
            {f.social.map((x, i) => (
              <a key={i} href={x.url} target="_blank" rel="noreferrer" aria-label={NETWORKS[x.network]}>
                {ICONS[x.network]}
              </a>
            ))}
          </div>
        )}
        {f.email && (
          <a href={`mailto:${f.email}`} className={s.email}>
            {f.email}
          </a>
        )}
        <span className={s.copy}>{t(f.copyright, f.copyright_en)}</span>
      </div>
    </footer>
  );
}
