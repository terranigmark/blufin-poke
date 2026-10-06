"use client";

import { useEffect, useState } from "react";
import { AGUAS, BEERS, BOWL_EXTRAS, NACIONAL, PHOTOS, PROTEIN_NOTE, SIZES, STEPS, money } from "@/data/menu";
import s from "./tv.module.css";

/*
 * Restaurant TV screen, laid out at 1920×1080 and scaled to fit any display.
 * Left half: the poke menu. Right half: drink lists that rotate.
 * URL options: ?s=10 (seconds per drink screen, 4–30) · ?lado=der (poke on the right)
 */

type Slide = {
  key: string;
  title: string;
  script: string;
  img: string;
  variant: "beer" | "aguas" | "nac";
  items: { name: string; meta: string; prices: string[] }[];
};

const SLIDES: Slide[] = [
  {
    key: "beer",
    title: "Cerveza artesanal",
    script: "Black Marlin Brewing",
    img: PHOTOS.tvBeer,
    variant: "beer",
    items: BEERS.map((b) => ({ name: b.name, meta: `De barril · ${b.style} · ${b.abv}`, prices: [money(b.price12), money(b.price16)] })),
  },
  {
    key: "aguas",
    title: "Aguas y refrescos",
    script: "Bien frías",
    img: PHOTOS.tvAguas,
    variant: "aguas",
    items: AGUAS.map((a) => ({ name: a.name, meta: `${a.pack} · ${a.size}`, prices: [money(a.price)] })),
  },
  {
    key: "nac",
    title: "Cerveza nacional",
    script: "Las de siempre",
    img: PHOTOS.tvNac,
    variant: "nac",
    items: NACIONAL.map((a) => ({ name: a.name, meta: `${a.pack} · ${a.size}`, prices: [money(a.price)] })),
  },
];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function MenuTV() {
  const [i, setI] = useState(0);
  const [scale, setScale] = useState(1);
  const [seconds, setSeconds] = useState(10);
  const [pokeRight, setPokeRight] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const sec = Number(q.get("s"));
    if (sec) setSeconds(clamp(sec, 4, 30));
    setPokeRight(["der", "right", "derecha"].includes(q.get("lado") ?? ""));
  }, []);

  // TVs may never fire a resize, so measure on load and observe from then on.
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080) || 1);
    fit();
    window.addEventListener("resize", fit);
    const ro = new ResizeObserver(fit);
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), seconds * 1000);
    return () => clearInterval(t);
  }, [seconds]);

  return (
    <div className={s.screen}>
      <div className={s.stage} style={{ transform: `translate(-50%, -50%) scale(${scale})`, flexDirection: pokeRight ? "row-reverse" : "row" }}>
        <section className={s.poke}>
          <div className={s.pokeHead}>
            <div className={s.pokeHeadText}>
              <div className={s.brand}>
                <span className={s.blufin}>Blufin</span>
                <span className={s.brandRule} />
                <span className={s.pokeco}>Poke Co</span>
              </div>
              <h1>Arma tu poke</h1>
              <div className={s.prices}>
                {SIZES.map((z) => (
                  <span key={z.id}>
                    <span>{z.name}</span>
                    <span className={s.blue}>{money(z.price)}</span>
                  </span>
                ))}
              </div>
            </div>
            <img src={PHOTOS.bowl(600)} alt="Poke bowl" className={s.bowl} />
          </div>

          <div className={s.steps}>
            {STEPS.map((x, n) => (
              <div key={x.key} className={s.stepCol}>
                <div className={s.stepHead}>
                  <span className={s.stepNum}>{n + 1}</span>
                  <span className={s.stepTitle}>{x.short}</span>
                </div>
                <span className={s.rule}>{x.tvRule}</span>
                <div className={s.opts}>
                  {x.opts.map((o) => (
                    <span key={o.id}>{o.name}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className={s.foot}>
            <div className={s.extras}>
              <span className={s.extrasTitle}>Extras</span>
              {BOWL_EXTRAS.map((e) => (
                <span key={e.id} className={s.extra}>
                  {e.name} <span className={s.blue}>{money(e.price)}</span>
                </span>
              ))}
            </div>
            <span className={s.note}>{PROTEIN_NOTE}</span>
          </div>
        </section>

        <section className={s.drinks}>
          {SLIDES.map((d, k) => {
            const active = k === i;
            const prev = k === (i + SLIDES.length - 1) % SLIDES.length;
            return (
              <div
                key={d.key}
                className={`${s.slide} ${s[d.variant]}`}
                style={{ opacity: active ? 1 : 0, transform: `translateX(${active ? 0 : prev ? -60 : 60}px)` }}
                aria-hidden={!active}
              >
                <div className={s.band}>
                  <img src={d.img} alt={d.title} />
                  <div className={s.bandShade} />
                  <div className={s.bandText}>
                    <span className={s.script}>{d.script}</span>
                    <span className={s.slideTitle}>{d.title}</span>
                  </div>
                </div>
                <div className={s.list}>
                  {d.variant === "beer" && (
                    <div className={s.ozHead}>
                      <span />
                      <span>12 oz</span>
                      <span>16 oz</span>
                    </div>
                  )}
                  <div className={s.items}>
                    {d.items.map((it) => (
                      <div key={it.name} className={s.item}>
                        <span className={s.itemText}>
                          <span className={s.itemName}>{it.name}</span>
                          <span className={s.itemMeta}>{it.meta}</span>
                        </span>
                        {it.prices.map((p, j) => (
                          <span key={j} className={s.itemPrice}>
                            {p}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <div className={s.dots}>
            {SLIDES.map((d, k) => (
              <div key={d.key} className={s.dot} data-on={k === i}>
                <span className={s.track}>
                  {/* Re-keyed each turn so the fill restarts from 0. */}
                  <span key={k === i ? `on-${i}` : "off"} className={s.fill} style={{ animationDuration: `${seconds}s` }} />
                </span>
                <span className={s.dotLabel}>{d.title}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
