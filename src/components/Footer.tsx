import { BUSINESS } from "@/data/menu";
import s from "./Footer.module.css";

export function Footer({ className = "" }: { className?: string }) {
  return (
    <footer className={`${s.footer} ${className}`}>
      <div className={s.inner}>
        <span className={s.blufin}>Blufin</span>
        <span className={s.brands}>Poke Co · Black Marlin Brewing</span>
        <span className={s.city}>La Paz, Baja California Sur</span>
        <div className={s.social}>
          <a href={BUSINESS.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <a href={BUSINESS.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V10.5H7.8v3h2.6V21h3.1z" />
            </svg>
          </a>
          <a href={BUSINESS.social.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.6 3c.4 2.2 1.8 3.6 4 3.8v3.1c-1.5.1-2.9-.4-4-1.2v6.1c0 3.4-2.7 5.9-5.9 5.9S4.8 18.2 4.8 15c0-3.5 3.1-6.2 6.7-5.8v3.2c-1.7-.4-3.5.8-3.5 2.6 0 1.5 1.2 2.7 2.7 2.7s2.7-1.2 2.7-2.9V3h3.2z" />
            </svg>
          </a>
        </div>
        <a href={`mailto:${BUSINESS.email}`} className={s.email}>
          {BUSINESS.email}
        </a>
        <span className={s.copy}>© 2026 Blufin Poke Co. Todos los derechos reservados.</span>
      </div>
    </footer>
  );
}
