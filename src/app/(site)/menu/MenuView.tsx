"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AGUAS, BEERS, MENU_EXTRAS, NACIONAL, PHOTOS, SIZES, money } from "@/data/menu";
import s from "./menu.module.css";

const TABS = [
  ["all", "Todo"],
  ["poke", "Poke"],
  ["beer", "Black Marlin"],
  ["aguas", "Aguas y refrescos"],
  ["nac", "Cerveza nacional"],
  ["extras", "Extras"],
] as const;
type Tab = (typeof TABS)[number][0];
const isTab = (v: string | null): v is Tab => TABS.some(([id]) => id === v);

function PriceList({ title, items }: { title: string; items: { name: string; price: number; size?: string }[] }) {
  return (
    <section className={s.list}>
      <div className={s.listHead}>
        <h2>{title}</h2>
      </div>
      {items.map((i) => (
        <div key={i.name} className={s.listRow}>
          <span className={s.listName}>{i.name}</span>
          <span className={s.listPrice}>{money(i.price)}</span>
          <span className={s.listSize}>{i.size ?? ""}</span>
        </div>
      ))}
    </section>
  );
}

export function MenuView() {
  const [tab, setTab] = useState<Tab>("all");

  // ?tab=beer etc. lets other pages deep-link into a filtered menu.
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tab");
    if (isTab(t)) setTab(t);
  }, []);

  const select = (t: Tab) => {
    setTab(t);
    const url = new URL(location.href);
    if (t === "all") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    history.replaceState(history.state, "", url);
  };
  const has = (k: Tab) => tab === "all" || tab === k;

  return (
    <main>
      <section className={s.hero}>
        <img src={PHOTOS.menuBar} alt="Barra de cervezas" className={s.heroImg} />
        <div className={s.heroShade} />
        <div className={s.heroInner}>
          <span className={s.heroScript}>Baja beer for ocean people</span>
          <h1 className={s.heroTitle}>Menú</h1>
        </div>
      </section>

      <div className={s.tabsBar}>
        <div className={s.tabs}>
          {TABS.map(([id, label]) => (
            <button key={id} className={s.tab} aria-pressed={tab === id} onClick={() => select(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={s.body}>
        {has("poke") && (
          <section className={s.poke}>
            <div className={s.sectionHead}>
              <h2>Poke bowls</h2>
            </div>
            <div className={s.sizes}>
              {SIZES.map((z) => (
                <div key={z.id} className={s.sizeRow}>
                  <span className={s.sizeName}>{z.name}</span>
                  <span className={s.sizePrice}>{money(z.price)}</span>
                </div>
              ))}
            </div>
            <Link href="/arma-tu-poke" className={s.pokeCta}>
              Arma tu poke →
            </Link>
          </section>
        )}

        {has("beer") && (
          <section className={s.beers}>
            <div className={`${s.sectionHead} ${s.beerHead}`}>
              <h2>Black Marlin Brewing Co.</h2>
            </div>
            {BEERS.map((b) => (
              <div key={b.tap} className={s.beer}>
                <div className={s.tap}>
                  <span className={s.tapLabel}>Tap {b.tap}</span>
                  <span className={s.tapDot} style={{ background: b.color }} />
                </div>
                <div className={s.beerInfo}>
                  <span className={s.beerName}>{b.name}</span>
                  <span className={s.beerDesc}>{b.desc}</span>
                  <div className={s.chips}>
                    <span className={s.chipSolid}>{b.style}</span>
                    <span className={s.chipLine}>ABV {b.abv}</span>
                  </div>
                </div>
                <div className={s.beerPrices}>
                  <span>
                    <span className={s.oz}>12 oz</span>
                    <span className={s.beerPrice}>{money(b.price12)}</span>
                  </span>
                  <span>
                    <span className={s.oz}>16 oz</span>
                    <span className={s.beerPrice}>{money(b.price16)}</span>
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}

        <div className={s.lists}>
          {has("aguas") && <PriceList title="Aguas y refrescos" items={AGUAS} />}
          {has("nac") && <PriceList title="Cerveza nacional" items={NACIONAL} />}
          {has("extras") && <PriceList title="Extras" items={MENU_EXTRAS} />}
        </div>
      </div>
    </main>
  );
}
