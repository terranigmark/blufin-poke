"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PHOTOS, STATUS_LABELS, money, srmColor, type Status } from "@/data/menu";
import { useMenu } from "@/lib/api";
import { useT } from "@/lib/i18n";
import s from "./menu.module.css";

// Each price list from the editor gets its own tab, by its key, between the beers and the extras.
type Tab = string;

/** The editor's "Marcar como…" badge; sold-out items also get their name struck through (see the CSS). */
function Badge({ status }: { status?: Status }) {
  const t = useT();
  if (!status) return null;
  return <span className={s.badge} data-status={status}>{t(...STATUS_LABELS[status])}</span>;
}

function PriceList({ title, items }: { title: string; items: { name: string; nameEn?: string; price: number; size?: string; status?: Status }[] }) {
  const t = useT();
  return (
    <section className={s.list}>
      <div className={s.listHead}>
        <h2>{title}</h2>
      </div>
      {items.map((i) => (
        <div key={i.name} className={s.listRow} data-status={i.status || undefined}>
          <span className={s.listName}>
            {t(i.name, i.nameEn)} <Badge status={i.status} />
          </span>
          <span className={s.listPrice}>{money(i.price)}</span>
          <span className={s.listSize}>{i.size ?? ""}</span>
        </div>
      ))}
    </section>
  );
}

export function MenuView() {
  const { BEERS, HOUSE_BOWLS, LISTS, MENU_EXTRAS, SIZES } = useMenu();
  const [picked, setTab] = useState<Tab>("all");
  const tabs: [Tab, string, string?][] = [
    ["all", "Todo", "All"],
    ["poke", "Poke", "Poke"],
    ["beer", "Black Marlin", "Black Marlin"],
    ...LISTS.map((l): [Tab, string, string?] => [l.key, l.name, l.nameEn]),
    ["extras", "Extras", "Extras"],
  ];
  // A deep link to a list that isn't (or isn't yet) on the menu shows everything.
  const tab = tabs.some(([id]) => id === picked) ? picked : "all";
  const t = useT();

  // ?tab=beer etc. lets other pages deep-link into a filtered menu.
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tab");
    if (t) setTab(t);
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
          {tabs.map(([id, label, en]) => (
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
                <div key={z.id} className={s.sizeRow} data-status={z.status || undefined}>
                  <span className={s.sizeName}>
                    {t(z.name, z.nameEn)} <Badge status={z.status} />
                  </span>
                  <span className={s.sizePrice}>{money(z.price)}</span>
                </div>
              ))}
            </div>
            <Link href="/arma-tu-poke" className={s.pokeCta}>
              {t("Arma tu poke", "Build your poke")} →
            </Link>
            {HOUSE_BOWLS.length > 0 && (
              <div className={s.sizes}>
                <h3 className={s.casaHead}>{t("Bowls de la casa", "House bowls")}</h3>
                {HOUSE_BOWLS.map((b) => (
                  <div key={b.id} className={s.sizeRow} data-status={b.status || undefined}>
                    <span>
                      <span className={s.sizeName}>
                        {t(b.name, b.nameEn)} <Badge status={b.status} />
                      </span>
                      {b.desc && <span className={s.casaDesc}>{t(b.desc, b.descEn)}</span>}
                    </span>
                    <span className={s.sizePrice}>{money(b.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {has("beer") && (
          <section className={s.beers}>
            <div className={`${s.sectionHead} ${s.beerHead}`}>
              <h2>Black Marlin Brewing Co.</h2>
            </div>
            {BEERS.map((b) => (
              <div key={b.tap} className={s.beer} data-status={b.status || undefined}>
                <div className={s.tap}>
                  <span className={s.tapLabel}>Tap {b.tap}</span>
                  <span className={s.tapDot} style={{ background: srmColor(b.srm) }} />
                </div>
                <div className={s.beerInfo}>
                  <span className={s.beerName}>
                    {t(b.name, b.nameEn)} <Badge status={b.status} />
                  </span>
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
          {LISTS.map((l) => has(l.key) && <PriceList key={l.key} title={t(l.name, l.nameEn)} items={l.items} />)}
          {has("extras") && <PriceList title="Extras" items={MENU_EXTRAS} />}
        </div>
      </div>
    </main>
  );
}
