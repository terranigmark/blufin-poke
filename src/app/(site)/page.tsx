"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { TextBand } from "@/components/TextBand";
import { BUSINESS, PHOTOS, STEPS, money, orderable } from "@/data/menu";
import { useLanding, useMenu } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { HeroMedia } from "./HeroMedia";
import s from "./home.module.css";

const TILES = [
  { label: "Extras", en: "Extras", img: PHOTOS.tileExtras, href: "/menu?tab=extras" },
  { label: "Bebidas", en: "Drinks", img: PHOTOS.tileDrinks, href: "/menu?tab=aguas" },
  { label: "Cerveza craft", en: "Craft beer", img: PHOTOS.tileBeer, href: "/menu?tab=beer" },
];

export default function Home() {
  const t = useT();
  const english = useLang().lang === "en";
  // Shown only once the manager has added three; sold-out or coming-soon bowls stay off the home page.
  const bowls = useMenu().HOUSE_BOWLS.filter(orderable).slice(0, 3);
  const { hero } = useLanding();
  return (
    <>
      <main>
        <section className={s.hero}>
          <HeroMedia image={hero.image} video={hero.video} />
          <div className={s.heroShade} />
          <div className={s.heroInner}>
            <span className={s.heroScript}>{t(hero.slogan, hero.slogan_en)}</span>
            <div className={s.heroHead}>
              <h1 className={s.heroTitle}>
                {t(hero.title, hero.title_en)
                  .split("\n")
                  .map((row, i) => (
                    <span key={i}>{row}</span>
                  ))}
              </h1>
              <p className={s.heroLead}>{t(hero.lead, hero.lead_en)}</p>
            </div>
            <div className={s.heroCtas}>
              <Link href="/arma-tu-poke" className={`${s.heroCta} ${s.heroCtaSolid}`}>
                {t("Arma tu poke", "Build your poke")}<span className={s.arrow}>→</span>
              </Link>
              <Link href="/menu" className={`${s.heroCta} ${s.heroCtaGhost}`}>
                {t("Ver menú", "See the menu")}<span className={s.arrow}>→</span>
              </Link>
            </div>
            <div className={s.heroInfo}>
              <span>{t(hero.hours, hero.hours_en)}</span>
              <span>{t(hero.address, hero.address_en)}</span>
            </div>
          </div>
        </section>

        <TextBand />

        {bowls.length === 3 && (
          <section className={s.casa} aria-labelledby="casa-title">
            <div className={s.casaInner}>
              <h2 id="casa-title" className={s.antojoTitle} data-reveal>
                {t("Bowls de la casa", "House bowls")}
              </h2>
              <div className={s.casaGrid} data-reveal>
                {bowls.map((b) => (
                  <article key={b.id} className={s.casaCard}>
                    <div className={s.casaPhoto}>
                      <img src={b.img ?? PHOTOS.bowl(800)} alt="" loading="lazy" />
                    </div>
                    <div className={s.casaText}>
                      <h3>{t(b.name, b.nameEn)}</h3>
                      <span className={s.casaPrice}>{money(b.price)}</span>
                    </div>
                    {b.desc && <p>{t(b.desc, b.descEn)}</p>}
                  </article>
                ))}
              </div>
              <div className={s.casaCta}>
                <Link href="/menu?tab=poke" className={s.navyPill}>
                  {t("Ver el menú", "See the menu")} →
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className={s.build}>
          <div className={s.buildGrid}>
            <div className={s.buildPhoto} data-reveal>
              <img src={PHOTOS.bowl(1200)} alt={t("Poke bowl de salmón", "Salmon poke bowl")} loading="lazy" />
            </div>
            <div className={s.buildCopy} data-reveal>
              <h2 className={s.buildTitle}>{t("Arma tu poke", "Build your poke")}</h2>
              <p className={s.buildLead}>{t("Seis pasos y tú decides todo. Lo armamos al momento.", "Six steps and you call the shots. We make it fresh to order.")}</p>
              <ol className={s.buildSteps}>
                {STEPS.map((x, i) => (
                  <li key={x.key}>
                    <span className={s.stepNum}>{i + 1}</span>
                    <span className={s.stepTitle}>{english ? x.en.title : x.title}</span>
                  </li>
                ))}
              </ol>
              <div>
                <Link href="/arma-tu-poke" className={s.buildCta}>
                  {t("Empezar mi bowl", "Start my bowl")} →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className={s.antojo}>
          <div className={s.antojoInner}>
            <h2 className={s.antojoTitle} data-reveal>{t("¿Qué se te antoja?", "What are you craving?")}</h2>
            <div className={s.tiles} data-reveal>
              {TILES.map((x) => (
                <Link key={x.label} href={x.href} className={s.tile}>
                  <img src={x.img} alt={t(x.label, x.en)} loading="lazy" />
                  <span className={s.tileShade} />
                  <span className={s.tileLabel}>{t(x.label, x.en)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="nosotros" className={s.esencia}>
          <div className={s.twoCol}>
            <div className={s.esenciaPhotos} data-reveal>
              <img src={PHOTOS.esenciaBowl} alt={t("Bowl fresco", "Fresh bowl")} className={s.esenciaA} loading="lazy" />
              <img src={PHOTOS.esenciaBeer} alt={t("Cerveza artesanal servida del grifo", "Craft beer poured from the tap")} className={s.esenciaB} loading="lazy" />
            </div>
            <div className={s.esenciaCopy} data-reveal>
              <h2 className={s.sectionTitle}>{t("Nuestra esencia es Baja", "Baja is who we are")}</h2>
              <p>{t("Pesca local, poke hecho al momento y cerveza de Black Marlin, nuestra cervecería. Así de simple.", "Local fish, poke made to order and beer from Black Marlin, our own brewery. Simple as that.")}</p>
              <div>
                <Link href="/menu?tab=beer" className={s.navyPill}>
                  {t("Conoce nuestras cervezas", "Meet our beers")} →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="ubicacion" className={s.ubicacion}>
          <div className={`${s.twoCol} ${s.stretch}`}>
            <div className={s.map} data-reveal>
              <iframe title={t("Mapa Blufin Poke Co", "Blufin Poke Co map")} src={BUSINESS.mapsEmbed} loading="lazy" />
            </div>
            <div className={s.visit} data-reveal>
              <h2 className={s.sectionTitle}>{t("Ven a vernos", "Come see us")}</h2>
              <div className={s.fact}>
                <span className={s.factLabel}>{t("Ubicación", "Location")}</span>
                <span className={s.factValue}>
                  {BUSINESS.addressLines[0]}
                  <br />
                  {BUSINESS.addressLines[1]}
                </span>
              </div>
              <div className={s.fact}>
                <span className={s.factLabel}>{t("Horarios", "Hours")}</span>
                <span className={s.factValue}>
                  {(english ? BUSINESS.hoursLinesEn : BUSINESS.hoursLines)[0]}
                  <br />
                  {(english ? BUSINESS.hoursLinesEn : BUSINESS.hoursLines)[1]}
                </span>
              </div>
              <div className={s.visitCtas}>
                <a href={BUSINESS.mapsLink} target="_blank" rel="noreferrer" className={s.navyPillSm}>
                  {t("Cómo llegar", "Get directions")} →
                </a>
                <a href={`mailto:${BUSINESS.email}`} className={s.visitEmail}>
                  {BUSINESS.email}
                </a>
              </div>
            </div>
          </div>
        </section>

        <TextBand />
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
