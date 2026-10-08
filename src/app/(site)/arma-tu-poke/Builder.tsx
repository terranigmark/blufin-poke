"use client";

import Link from "next/link";
import qrcode from "qrcode-generator";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BUILD_RESET_EVENT } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  BOWL_EXTRAS,
  DRINKS,
  DRINK_TABS,
  PHOTOS,
  PROTEIN_NOTE,
  SALSA_RECOMMENDED_MAX,
  SECOND_PROTEIN_PRICE,
  SIZES,
  STEPS,
  money,
  type DrinkCat,
  type SizeId,
  type Step,
  type StepKey,
} from "@/data/menu";
import { encodeOrder, type OrderData } from "@/lib/order";
import s from "./builder.module.css";

// Screens: 0 intro · 1–6 selection steps · 7 summary · 8 code/QR · 9 drinks
const SUMMARY = 7;
const DONE = 8;
const DRINKS_STEP = 9;

type Selection = Record<StepKey, string[]>;
const emptySelection = (): Selection => ({ base: [], protein: [], mix: [], salsa: [], top: [], crunch: [] });

const names = (st: Step, ids: string[]) => ids.map((id) => st.opts.find((o) => o.id === id)!.name).join(", ");

function drinkLines(drinks: Record<string, number>) {
  const out: string[] = [];
  DRINKS.forEach((d) =>
    d.sizes.forEach((z) => {
      const q = drinks[`${d.id}_${z.k}`];
      if (q > 0) out.push(`${q}× ${d.name}${z.label ? " " + z.label : ""}`);
    }),
  );
  return out;
}

function countLabel(st: Step, n: number) {
  if (st.max === 1) return "Elige 1";
  const picked = `${n} ${n === 1 ? "seleccionado" : "seleccionados"}`;
  if (st.max >= st.opts.length) return `${st.min ? `Mínimo ${st.min}, los que quieras` : "Elige los que quieras"} · ${picked}`;
  return `${st.min ? `Elige ${st.min} a ${st.max}` : `Hasta ${st.max}`} · ${n}/${st.max}`;
}

/** Desktop column count depends on option count; see builder.module.css. */
function gridClass(n: number) {
  if (n > 9) return s.cols10;
  if (n % 4 === 0) return s.cols4;
  return s.cols3;
}

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Builder() {
  const [step, setStepState] = useState(0);
  const [sel, setSel] = useState<Selection>(emptySelection);
  const [size, setSize] = useState<SizeId | null>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const [drinks, setDrinks] = useState<Record<string, number>>({});
  const [drinkTab, setDrinkTab] = useState<DrinkCat>("beer");
  const [order, setOrder] = useState<{ data: OrderData; url: string } | null>(null);

  const setStep = useCallback((n: number) => {
    setStepState(n);
    window.scrollTo(0, 0);
  }, []);

  // Header "Arma tu poke" while already here → back to the intro.
  useEffect(() => {
    const onReset = () => setStep(0);
    window.addEventListener(BUILD_RESET_EVENT, onReset);
    return () => window.removeEventListener(BUILD_RESET_EVENT, onReset);
  }, [setStep]);

  // ---- Screen transitions
  // Each screen is a `[data-screen]` section; the intro has a mobile and a
  // desktop version, so animate whichever one is actually displayed.
  const mainRef = useRef<HTMLElement>(null);
  const prevStep = useRef<number | null>(null);
  useLayoutEffect(() => {
    const pv = prevStep.current;
    prevStep.current = step;
    const sec = [...(mainRef.current?.querySelectorAll("[data-screen]") ?? [])].find((el) => el.getClientRects().length);
    if (!sec || !sec.animate || prefersReducedMotion()) return;
    const dir = pv === null || step > pv ? 1 : -1;
    const E = "cubic-bezier(0.23, 1, 0.32, 1)"; // --ease-out in globals.css
    const A = (el: Element | undefined, kf: Keyframe[], o: KeyframeAnimationOptions = {}) =>
      el?.animate(kf, { duration: 420, easing: E, fill: "backwards", ...o });
    const k = [...sec.children];
    if (step >= 1 && step <= 6) {
      // k: progress · title · grid · [sizes] · bar
      // The most repeated screen change on the site, so it stays quick: the stagger
      // caps at 8 cards, so even the 15-card steps are settled in about 0.5s.
      A(k[1], [{ opacity: 0, transform: `translateX(${dir * 40}px)` }, { opacity: 1, transform: "none" }], { duration: 260 });
      [...(k[2]?.children ?? [])].forEach((c, i) =>
        A(c, [{ opacity: 0, transform: "translateY(12px) scale(.97)" }, { opacity: 1, transform: "none" }], { delay: 40 + Math.min(i, 8) * 25, duration: 220 }),
      );
      if (k.length > 4) A(k[3], [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { delay: 120, duration: 220 });
    } else if (step === DONE) {
      A(k[0], [{ transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 1400 });
      A(k[2], [{ opacity: 0, transform: "translateY(30px)" }, { opacity: 1, transform: "none" }], { delay: 150, duration: 600 });
    } else {
      k.forEach((c, i) => A(c, [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }], { delay: i * 70, duration: 480 }));
    }
  }, [step]);

  // ---- Derived state
  const st = step >= 1 && step <= 6 ? STEPS[step - 1] : null;
  const canNext = !st || (sel[st.key].length >= st.min && (st.key !== "protein" || !!size));
  const sizeName = SIZES.find((z) => z.id === size)?.name;
  const dsel = drinkLines(drinks);
  const drinkTotal = Object.values(drinks).reduce((a, b) => a + b, 0);
  const drinkCount = drinkTotal ? `${drinkTotal} ${drinkTotal === 1 ? "bebida" : "bebidas"}` : "";

  type Row = { label: string; value: string; step: number | null };
  const summaryRows: Row[] = [];
  STEPS.forEach((x, i) => {
    summaryRows.push({ label: x.short, value: sel[x.key].length ? names(x, sel[x.key]) : "—", step: i + 1 });
    if (x.key === "protein") summaryRows.push({ label: "Tamaño", value: sizeName ?? "—", step: 2 });
  });
  if (dsel.length) summaryRows.push({ label: "Bebidas", value: dsel.join(", "), step: DRINKS_STEP });
  if (extras.length)
    summaryRows.push({ label: "Extras", value: extras.map((id) => BOWL_EXTRAS.find((e) => e.id === id)!.name).join(", "), step: null });

  // ---- Actions
  const toggle = (st: Step, id: string) =>
    setSel((prev) => {
      let a = prev[st.key];
      if (st.max === 1) a = [id];
      else if (a.includes(id)) a = a.filter((x) => x !== id);
      else if (a.length < st.max) a = [...a, id];
      else a = [...a.slice(1), id];
      return { ...prev, [st.key]: a };
    });

  const next = () => canNext && setStep(step + 1);
  const back = () => {
    if (step === DRINKS_STEP) setStep(SUMMARY);
    else if (step > 0) setStep(step - 1);
  };

  const confirm = () => {
    const rows: [string, string][] = [];
    const add = (l: string, v: string | undefined) => v && rows.push([l, v]);
    STEPS.forEach((x) => {
      add(x.short, sel[x.key].length ? names(x, sel[x.key]) : "");
      if (x.key === "protein") add("Tamaño", sizeName);
    });
    add("Extras", extras.map((id) => BOWL_EXTRAS.find((e) => e.id === id)!.name).join(", "));
    add("Bebidas", dsel.join(", "));
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const data: OrderData = { c: `#BF-${1000 + Math.floor(Math.random() * 9000)}`, t, r: rows };
    const url = `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/orden/#${encodeOrder(data)}`;
    setOrder({ data, url });
    setStep(DONE);
  };

  const reset = () => {
    setSel(emptySelection());
    setSize(null);
    setExtras([]);
    setDrinks({});
    setStep(1);
  };

  const qrSrc = useMemo(() => {
    if (!order) return "";
    const q = qrcode(0, "L");
    q.addData(order.url);
    q.make();
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }));
  }, [order]);

  const stepList = (
    <>
      {STEPS.map((x, i) => (
        <li key={x.key}>
          <span className={s.listNum}>{i + 1}</span>
          <span className={s.listTitle}>{x.title}</span>
        </li>
      ))}
    </>
  );

  return (
    <>
      <main ref={mainRef} className={s.main} data-step={step}>
        {/* ---------------- Intro */}
        {step === 0 && (
          <>
            <section data-screen className={s.introMob}>
              <div className={s.introMobHead}>
                <h1>Arma tu poke</h1>
                <div className={s.introMobRule} />
                <span>Tu bowl. A tu manera.</span>
              </div>
              <div className={s.introMobPhoto}>
                <img src={PHOTOS.bowl(900)} alt="Poke bowl frente al mar" />
                <div className={s.introMobFade} />
                <span>
                  Fresh poke,
                  <br />
                  happier people
                </span>
              </div>
              <ol className={s.introMobList}>{stepList}</ol>
              <div className={s.introMobFoot}>
                <button className={s.startBtn} onClick={() => setStep(1)}>
                  Empezar<span className={s.arrow}>→</span>
                </button>
                <div className={s.place}>
                  <span />
                  La Paz, BCS
                  <span />
                </div>
              </div>
            </section>
            <IntroDesk onStart={() => setStep(1)} stepList={stepList} />
          </>
        )}

        {/* ---------------- Steps 1–6 */}
        {st && (
          <div className={s.stepBox}>
            <section data-screen className={s.step} data-photo={st.photo}>
              <div className={s.progress}>
                {STEPS.map((x, i) => (
                  <span key={x.key} data-on={i < step} />
                ))}
              </div>
              <div className={s.stepHead}>
                <h1 className={s.stepTitle}>{st.title}</h1>
                <div className={s.countRow}>
                  <span className={s.count}>{countLabel(st, sel[st.key].length)}</span>
                  {st.key === "protein" && sel.protein.length > 1 && (
                    <span className={s.notice}>
                      <span>+</span>La segunda proteína tiene costo extra: +{money(SECOND_PROTEIN_PRICE)}
                    </span>
                  )}
                  {st.key === "salsa" && sel.salsa.length > SALSA_RECOMMENDED_MAX && (
                    <span className={s.notice}>
                      <span>!</span>Te recomendamos hasta {SALSA_RECOMMENDED_MAX} salsas
                    </span>
                  )}
                </div>
              </div>

              <div className={`${s.grid} ${gridClass(st.opts.length)}`}>
                {st.opts.map((o) => {
                  const on = sel[st.key].includes(o.id);
                  return (
                    <button key={o.id} className={s.card} aria-pressed={on} onClick={() => toggle(st, o.id)}>
                      {o.img ? (
                        <img src={o.img} alt={o.name} className={s.cardImg} />
                      ) : (
                        <div className={`${s.cardImg} ${s.cardPh}`}>foto</div>
                      )}
                      <div className={s.cardName}>
                        <span>{o.name}</span>
                      </div>
                      <span className={s.check}>{on ? "✓" : ""}</span>
                    </button>
                  );
                })}
              </div>

              {st.key === "protein" && (
                <div className={s.sizeBlock}>
                  <div className={s.sizeHead}>
                    <span className={s.sizeLabel}>Elige tu tamaño</span>
                    <span className={s.sizeNote}>{PROTEIN_NOTE}</span>
                  </div>
                  <div className={s.sizes}>
                    {SIZES.map((z) => (
                      <button key={z.id} className={s.size} aria-pressed={size === z.id} onClick={() => setSize(z.id)}>
                        <span className={s.sizeName}>{z.name}</span>
                        <span className={s.sizePrice}>{money(z.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={s.bar}>
                <button className={s.backBtn} onClick={back}>
                  ← Atrás
                </button>
                <button className={s.nextBtn} data-disabled={!canNext} onClick={next}>
                  {step === 6 ? "Ver mi bowl" : "Siguiente"} →
                </button>
              </div>
            </section>

            <aside className={s.aside}>
              <span className={s.asideTitle}>Tu bowl</span>
              <div className={s.asideRows}>
                {summaryRows.map((r) => (
                  <button
                    key={r.label}
                    data-current={r.step === step}
                    onClick={() => r.step !== null && r.step < step && setStep(r.step)}
                  >
                    <span className={s.rowLabel}>{r.label}</span>
                    <span className={s.asideValue}>{r.value}</span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        )}

        {/* ---------------- Summary */}
        {step === SUMMARY && (
          <section data-screen className={s.summary}>
            <div>
              <h1 className={s.screenTitle}>Así queda tu bowl</h1>
            </div>
            <div className={s.summaryGrid}>
              <div className={s.summaryRows}>
                {summaryRows.map((r) => (
                  <button key={r.label} onClick={() => r.step !== null && setStep(r.step)}>
                    <span className={s.summaryRowText}>
                      <span className={s.rowLabelBlue}>{r.label}</span>
                      <span className={s.summaryValue}>{r.value}</span>
                    </span>
                    <span className={s.edit}>Editar</span>
                  </button>
                ))}
              </div>
              <div className={s.summarySide}>
                <span className={s.extrasTitle}>Extras</span>
                <div className={s.extras}>
                  {BOWL_EXTRAS.map((e) => {
                    const on = extras.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        aria-pressed={on}
                        onClick={() => setExtras(on ? extras.filter((x) => x !== e.id) : [...extras, e.id])}
                      >
                        <span className={s.extraName}>{e.name}</span>
                        <span className={s.extraPrice}>+{money(e.price)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className={s.summaryCtas}>
                  <button className={s.addDrink} onClick={() => setStep(DRINKS_STEP)}>
                    + Agregar bebida
                  </button>
                  <button className={s.confirmBtn} onClick={confirm}>
                    Generar mi código →
                  </button>
                  <button className={s.outlineBack} onClick={back}>
                    ← Atrás
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ---------------- Drinks */}
        {step === DRINKS_STEP && (
          <section data-screen className={s.drinks}>
            <div className={s.drinksHead}>
              <h1 className={s.screenTitle}>Agrega una bebida</h1>
              {drinkCount && <span className={`${s.count} ${s.mobileOnly}`}>{drinkCount}</span>}
              <div className={s.drinkTabs}>
                {DRINK_TABS.map(([id, label]) => (
                  <button key={id} aria-pressed={drinkTab === id} onClick={() => setDrinkTab(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.drinkList}>
              {DRINKS.filter((d) => d.cat === drinkTab).map((d) => (
                <div key={d.id} className={s.drink}>
                  <span className={s.drinkInfo}>
                    <span className={s.drinkName}>{d.name}</span>
                    <span className={s.drinkMeta}>{d.meta}</span>
                  </span>
                  <div className={s.drinkOpts}>
                    {d.sizes.map((z) => {
                      const key = `${d.id}_${z.k}`;
                      const q = drinks[key] || 0;
                      const set = (v: number) => setDrinks((p) => ({ ...p, [key]: Math.max(0, v) }));
                      return (
                        <div key={z.k} className={s.drinkOpt}>
                          <span className={s.drinkSize}>{z.label}</span>
                          <span className={s.drinkPrice}>{money(z.price)}</span>
                          <div className={s.counter}>
                            <button aria-label="Quitar" className={s.dec} data-zero={q === 0} onClick={() => set(q - 1)}>
                              −
                            </button>
                            <span>{q}</span>
                            <button aria-label="Agregar" className={s.inc} onClick={() => set(q + 1)}>
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className={`${s.bar} ${s.drinkBar}`}>
              <button className={s.backBtn} onClick={back}>
                ← Atrás
              </button>
              <span className={`${s.count} ${s.desktopOnly}`}>{drinkCount}</span>
              <button className={s.nextBtn} onClick={confirm}>
                Generar código →
              </button>
            </div>
          </section>
        )}

        {/* ---------------- QR / thank you */}
        {step === DONE && order && (
          <section data-screen className={s.done}>
            <img src={PHOTOS.doneBeach} alt="Playa al atardecer" className={s.doneImg} />
            <div className={s.doneShade} />
            <div className={s.doneInner}>
              <div className={s.doneLeft}>
                <span className={s.thanks}>Gracias por ser parte de la Baja Vibe</span>
                <div className={s.qrCard}>
                  <img src={qrSrc} alt="Código QR de tu pedido" className={s.qr} />
                  <span className={s.orderCode}>{order.data.c}</span>
                </div>
                <span className={s.showWaiter}>Muestra este código a tu mesero</span>
                <span className={s.brightness}>Sube el brillo de tu pantalla para que lo escanee más rápido.</span>
              </div>
              <div className={s.doneRight}>
                <div className={s.ticket}>
                  <div className={s.ticketHead}>
                    <span>Tu pedido</span>
                    <span>{order.data.t}</span>
                  </div>
                  {order.data.r.map(([label, value]) => (
                    <div key={label} className={s.ticketRow}>
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
                <div className={s.doneCtas}>
                  <button className={s.again} onClick={reset}>
                    Armar otro
                  </button>
                  <Link href="/menu" className={s.toMenu}>
                    Ver menú
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      {/* The flow is a full-screen app on desktop; mobile shows the footer after the steps. */}
      {step >= SUMMARY && (
        <div className={s.mobileOnlyBlock}>
          <Footer />
        </div>
      )}
    </>
  );
}

function IntroDesk({ onStart, stepList }: { onStart: () => void; stepList: React.ReactNode }) {
  return (
    <section data-screen className={s.introDesk}>
      <div className={s.introDeskCopy}>
        <h1>Arma tu poke</h1>
        <div className={s.introDeskRule} />
        <p>Tu bowl. A tu manera.</p>
        <ol className={s.introDeskList}>{stepList}</ol>
        <div className={s.introDeskCtas}>
          <button className={s.startBtn} onClick={onStart}>
            Empezar<span className={s.arrow}>→</span>
          </button>
        </div>
      </div>
      <div className={s.introDeskPhoto}>
        <img src={PHOTOS.bowl(1100)} alt="Poke bowl" />
        <span>
          Fresh poke,
          <br />
          happier people
        </span>
      </div>
    </section>
  );
}
