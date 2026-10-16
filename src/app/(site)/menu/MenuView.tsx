"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PHOTOS, money } from "@/data/menu";
import { useMenu } from "@/lib/api";
import { useT } from "@/lib/i18n";
import s from "./menu.module.css";

const TABS = [
  ["all", "Todo", "All"],
  ["poke", "Poke", "Poke"],
  ["beer", "Black Marlin", "Black Marlin"],
  ["aguas", "Aguas y refrescos", "Water & soft drinks"],
  ["nac", "Cerveza nacional", "Mexican beer"],
  ["extras", "Extras", "Extras"],
] as const;
type Tab = (typeof TABS)[number][0];
const isTab = (v: string | null): v is Tab => TABS.some(([id]) => id === v);

function PriceList({ title, items }: { title: string; items: { name: string; nameEn?: string; price: number; size?: string }[] }) {
  const t = useT();
  return (
    <section className={s.list}>
      <div className={s.listHead}>
        <h2>{title}</h2>
      </div>
      {items.map((i) => (
        <div key={i.name} className={s.listRow}>
          <span className={s.listName}>{t(i.name, i.nameEn)}</span>
          <span className={s.listPrice}>{money(i.price)}</span>
          <span className={s.listSize}>{i.size ?? ""}</span>
        </div>
      ))}
    </section>
  );
}

export function MenuView() {
  const { AGUAS, BEERS, MENU_EXTRAS, NACIONAL, SIZES } = useMenu();
  const [tab, setTab] = useState<Tab>("all");
  const t = useT();

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
        <img src={PHOTOS.menuBar} alt={t("Barra de cervezas", "Beer bar")} className={s.heroImg} />
        <div className={s.heroShade} />
        <div className={s.heroInner}>
          <span className={s.heroScript}>Baja beer for ocean people</span>
          <h1 className={s.heroTitle}>{t("Menú", "Menu")}</h1>
        </div>
      </section>

      <div className={s.tabsBar}>
        <div className={s.tabs}>
          {TABS.map(([id, label, en]) => (
            <button key={id} className={s.tab} aria-pressed={tab === id} onClick={() => select(id)}>
              {t(label, en)}
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
                  <span className={s.sizeName}>{t(z.name, z.nameEn)}</span>
                  <span className={s.sizePrice}>{money(z.price)}</span>
                </div>
              ))}
            </div>
            <Link href="/arma-tu-poke" className={s.pokeCta}>
              {t("Arma tu poke", "Build your poke")} →
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
                  <span className={s.beerName}>{t(b.name, b.nameEn)}</span>
                  <span className={s.beerDesc}>{t(b.desc, b.descEn)}</span>
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
          {has("aguas") && <PriceList title={t("Aguas y refrescos", "Water & soft drinks")} items={AGUAS} />}
          {has("nac") && <PriceList title={t("Cerveza nacional", "Mexican beer")} items={NACIONAL} />}
          {has("extras") && <PriceList title="Extras" items={MENU_EXTRAS} />}
        </div>
      </div>
    </main>
  );
}
