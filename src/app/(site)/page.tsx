"use client";

import Link from "next/link";
import { Fragment } from "react";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { TextBand } from "@/components/TextBand";
import { mapsFor } from "@/data/landing";
import { PHOTOS, money, orderable } from "@/data/menu";
import { mediaUrl, useLanding, useMenu } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { HeroMedia } from "./HeroMedia";
import s from "./home.module.css";

export default function Home() {
  const t = useT();
  // Shown only once the manager has added three; sold-out or coming-soon bowls stay off the home page.
  const bowls = useMenu().HOUSE_BOWLS.filter(orderable).slice(0, 3);
  const { hero, build, cravings, esencia, visit } = useLanding();
  const maps = mapsFor(visit.address);
  // Multi-line fields from /admin: one row each.
  const rows = (text: string) =>
    text.split("\n").map((row, i) => (
      <Fragment key={i}>
        {i > 0 && <br />}
        {row}
      </Fragment>
    ));
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
              {build.image && <img src={mediaUrl(build.image)} alt={t("Poke bowl de salmón", "Salmon poke bowl")} loading="lazy" />}
            </div>
            <div className={s.buildCopy} data-reveal>
              <h2 className={s.buildTitle}>{t(build.title, build.title_en)}</h2>
              <p className={s.buildLead}>{t(build.lead, build.lead_en)}</p>
              <ol className={s.buildSteps}>
                {build.steps.map((x, i) => (
                  <li key={i}>
                    <span className={s.stepNum}>{i + 1}</span>
                    <span className={s.stepTitle}>{t(x.text, x.text_en)}</span>
                  </li>
                ))}
              </ol>
              <div>
                <Link href="/arma-tu-poke" className={s.buildCta}>
                  {t(build.cta, build.cta_en)} →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className={s.antojo}>
          <div className={s.antojoInner}>
            <h2 className={s.antojoTitle} data-reveal>{t(cravings.title, cravings.title_en)}</h2>
            <div className={s.tiles} data-reveal>
              {cravings.tiles.map((x, i) => (
                <Link key={i} href={x.link} className={s.tile}>
                  <img src={mediaUrl(x.image)} alt={t(x.text, x.text_en)} loading="lazy" />
                  <span className={s.tileShade} />
                  <span className={s.tileLabel}>{t(x.text, x.text_en)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="nosotros" className={s.esencia}>
          <div className={s.twoCol}>
            <div className={s.esenciaPhotos} data-reveal>
              {esencia.image_a && <img src={mediaUrl(esencia.image_a)} alt={t("Bowl fresco", "Fresh bowl")} className={s.esenciaA} loading="lazy" />}
              {esencia.image_b && <img src={mediaUrl(esencia.image_b)} alt={t("Cerveza artesanal servida del grifo", "Craft beer poured from the tap")} className={s.esenciaB} loading="lazy" />}
            </div>
            <div className={s.esenciaCopy} data-reveal>
              <h2 className={s.sectionTitle}>{t(esencia.title, esencia.title_en)}</h2>
              <p>{t(esencia.lead, esencia.lead_en)}</p>
              <div>
                <Link href="/menu?tab=beer" className={s.navyPill}>
                  {t(esencia.cta, esencia.cta_en)} →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="ubicacion" className={s.ubicacion}>
          <div className={`${s.twoCol} ${s.stretch}`}>
            <div className={s.map} data-reveal>
              <iframe title={t("Mapa Blufin Poke Co", "Blufin Poke Co map")} src={maps.embed} loading="lazy" />
            </div>
            <div className={s.visit} data-reveal>
              <h2 className={s.sectionTitle}>{t(visit.title, visit.title_en)}</h2>
              <div className={s.fact}>
                <span className={s.factLabel}>{t("Ubicación", "Location")}</span>
                <span className={s.factValue}>{rows(visit.address)}</span>
              </div>
              <div className={s.fact}>
                <span className={s.factLabel}>{t("Horarios", "Hours")}</span>
                <span className={s.factValue}>{rows(t(visit.hours, visit.hours_en))}</span>
              </div>
              <div className={s.visitCtas}>
                <a href={maps.link} target="_blank" rel="noreferrer" className={s.navyPillSm}>
                  {t(visit.cta, visit.cta_en)} →
                </a>
                {visit.email && (
                  <a href={`mailto:${visit.email}`} className={s.visitEmail}>
                    {visit.email}
                  </a>
                )}
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
