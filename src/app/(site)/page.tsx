import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { BUSINESS, PHOTOS, STEPS } from "@/data/menu";
import s from "./home.module.css";

const TILES = [
  { label: "Extras", img: PHOTOS.tileExtras, href: "/menu?tab=extras" },
  { label: "Bebidas", img: PHOTOS.tileDrinks, href: "/menu?tab=aguas" },
  { label: "Cerveza craft", img: PHOTOS.tileBeer, href: "/menu?tab=beer" },
];

export default function Home() {
  return (
    <>
      <main>
        <section className={s.hero}>
          <img src={PHOTOS.heroSunset} alt="Atardecer sobre el mar de Cortés" className={s.heroImg} fetchPriority="high" />
          <div className={s.heroShade} />
          <div className={s.heroInner}>
            <span className={s.heroScript}>Good food, cold beer, salty people</span>
            <h1 className={s.heroTitle}>
              <span>Poke • Baja</span>
              <span>Craft Beer</span>
            </h1>
            <p className={s.heroLead}>Pesca del día, cerveza de la casa y nada de prisa.</p>
            <div className={s.heroCtas}>
              <Link href="/arma-tu-poke" className={`${s.heroCta} ${s.heroCtaSolid}`}>
                Arma tu poke<span className={s.arrow}>→</span>
              </Link>
              <Link href="/menu" className={`${s.heroCta} ${s.heroCtaGhost}`}>
                Ver menú<span className={s.arrow}>→</span>
              </Link>
            </div>
            <div className={s.heroInfo}>
              <span>{BUSINESS.hoursShort}</span>
              <span>{BUSINESS.addressShort}</span>
            </div>
          </div>
        </section>

        <section className={s.build}>
          <div className={s.buildGrid}>
            <div className={s.buildPhoto} data-reveal>
              <img src={PHOTOS.bowl(1200)} alt="Poke bowl de salmón" loading="lazy" />
            </div>
            <div className={s.buildCopy} data-reveal>
              <h2 className={s.buildTitle}>Arma tu poke</h2>
              <p className={s.buildLead}>Seis pasos y tú decides todo. Lo armamos al momento.</p>
              <ol className={s.buildSteps}>
                {STEPS.map((x, i) => (
                  <li key={x.key}>
                    <span className={s.stepNum}>{i + 1}</span>
                    <span className={s.stepTitle}>{x.title}</span>
                  </li>
                ))}
              </ol>
              <div>
                <Link href="/arma-tu-poke" className={s.buildCta}>
                  Empezar mi bowl →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className={s.antojo}>
          <div className={s.antojoInner}>
            <h2 className={s.antojoTitle} data-reveal>¿Qué se te antoja?</h2>
            <div className={s.tiles} data-reveal>
              {TILES.map((t) => (
                <Link key={t.label} href={t.href} className={s.tile}>
                  <img src={t.img} alt={t.label} loading="lazy" />
                  <span className={s.tileShade} />
                  <span className={s.tileLabel}>{t.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="nosotros" className={s.esencia}>
          <div className={s.twoCol}>
            <div className={s.esenciaPhotos} data-reveal>
              <img src={PHOTOS.esenciaBowl} alt="Bowl fresco" className={s.esenciaA} loading="lazy" />
              <img src={PHOTOS.esenciaBeer} alt="Cerveza artesanal servida del grifo" className={s.esenciaB} loading="lazy" />
            </div>
            <div className={s.esenciaCopy} data-reveal>
              <h2 className={s.sectionTitle}>Nuestra esencia es Baja</h2>
              <p>Pesca local, poke hecho al momento y cerveza de Black Marlin, nuestra cervecería. Así de simple.</p>
              <div>
                <Link href="/menu?tab=beer" className={s.navyPill}>
                  Conoce nuestras cervezas →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="ubicacion" className={s.ubicacion}>
          <div className={`${s.twoCol} ${s.stretch}`}>
            <div className={s.map} data-reveal>
              <iframe title="Mapa Blufin Poke Co" src={BUSINESS.mapsEmbed} loading="lazy" />
            </div>
            <div className={s.visit} data-reveal>
              <h2 className={s.sectionTitle}>Ven a vernos</h2>
              <div className={s.fact}>
                <span className={s.factLabel}>Ubicación</span>
                <span className={s.factValue}>
                  {BUSINESS.addressLines[0]}
                  <br />
                  {BUSINESS.addressLines[1]}
                </span>
              </div>
              <div className={s.fact}>
                <span className={s.factLabel}>Horarios</span>
                <span className={s.factValue}>
                  {BUSINESS.hoursLines[0]}
                  <br />
                  {BUSINESS.hoursLines[1]}
                </span>
              </div>
              <div className={s.visitCtas}>
                <a href={BUSINESS.mapsLink} target="_blank" rel="noreferrer" className={s.navyPillSm}>
                  Cómo llegar →
                </a>
                <a href={`mailto:${BUSINESS.email}`} className={s.outlinePillSm}>
                  {BUSINESS.email}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
