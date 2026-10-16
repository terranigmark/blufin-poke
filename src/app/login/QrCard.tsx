"use client";

import qrcode from "qrcode-generator";
import { useAdminT } from "./Editor";
import s from "./editor.module.css";

/*
 * /admin's "Códigos QR": a QR for each public menu, to print for the tables and the bar.
 * They always point at the live site, whichever address /admin was opened on.
 */

const SITE = "https://blufinpoke.com";
export const MENUS = [
  { path: "/menu/", file: "blufin-menu-qr.png", es: "Menú", en: "Menu", hintEs: "Para las mesas: el menú en el celular.", hintEn: "For the tables: the menu on a phone." },
  { path: "/menu-tv/", file: "blufin-menu-tv-qr.png", es: "Menú para TV", en: "TV menu", hintEs: "La versión para la pantalla de la barra.", hintEn: "The version for the screen at the bar." },
];

// "M" survives a smudged or slightly torn print better than the order QR's "L".
const make = (url: string) => {
  const q = qrcode(0, "M");
  q.addData(url);
  q.make();
  return q;
};

/** A print-sized PNG of the code: 16 px per module and the standard 4-module quiet zone. */
function download(url: string, file: string) {
  const q = make(url);
  const cell = 16;
  const margin = 4;
  const n = q.getModuleCount();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = (n + margin * 2) * cell;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = file;
  a.click();
}

export function QrCard() {
  const t = useAdminT();
  return (
    <>
      <p className={s.muted}>{t("Imprime estos códigos para que abran el menú desde el celular.", "Print these codes so people can open the menu from their phone.")}</p>
      {MENUS.map((m) => {
        const url = SITE + m.path;
        const svg = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(make(url).createSvgTag({ cellSize: 4, margin: 4, scalable: true }));
        return (
          <section key={m.path} className={s.card} aria-label={t(m.es, m.en)}>
            <div className={s.qr}>
              <img src={svg} alt={t(`Código QR de ${url}`, `QR code for ${url}`)} />
              <div>
                <h2 className={s.cardTitle}>{t(m.es, m.en)}</h2>
                <p className={s.muted}>{t(m.hintEs, m.hintEn)}</p>
                <a href={url} target="_blank" rel="noreferrer" className={s.qrLink}>
                  {url}
                </a>
                <button type="button" className={s.primary} onClick={() => download(url, m.file)}>
                  {t("Descargar PNG", "Download PNG")}
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
