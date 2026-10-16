// The home page's editable content, as /admin's "Página de inicio" cards save it (backend Landing).
// This copy is what the site shows until the API answers, or if it's down; backend
// migrations 0007, 0008 and 0011 seeded the same.

import { unsplash } from "./menu";

export type Word = { text: string; text_en: string };
export type Tile = Word & { image: string; link: string };
export type Social = { network: Network; url: string };

/** The networks the footer has an icon for, as /admin lists them. */
export const NETWORKS = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", x: "X", youtube: "YouTube", whatsapp: "WhatsApp" };
export type Network = keyof typeof NETWORKS;

export type Landing = {
  header: { marlin_logo: string; blufin_logo: string };
  hero: {
    image: string;
    video: string;
    slogan: string;
    slogan_en: string;
    /** One line per row of the big title. */
    title: string;
    title_en: string;
    lead: string;
    lead_en: string;
    hours: string;
    hours_en: string;
    address: string;
    address_en: string;
  };
  belt: { words: Word[] };
  build: { title: string; title_en: string; lead: string; lead_en: string; steps: Word[]; cta: string; cta_en: string; image: string };
  cravings: { title: string; title_en: string; tiles: Tile[] };
  esencia: { title: string; title_en: string; lead: string; lead_en: string; image_a: string; image_b: string; cta: string; cta_en: string };
  /** "Ubicación": the map follows `address`. Multi-line fields show one line per row. */
  visit: { title: string; title_en: string; address: string; hours: string; hours_en: string; cta: string; cta_en: string; email: string };
  footer: { brand: string; tagline: string; tagline_en: string; city: string; copyright: string; copyright_en: string; social: Social[]; email: string };
};

export const LANDING: Landing = {
  // Empty: the lettering drawn in CSS.
  header: { marlin_logo: "", blufin_logo: "" },
  hero: {
    image: "/video/hero-waves-poster.jpg",
    video: "/video/hero-waves.mp4",
    slogan: "Buena comida, cerveza fría, gente de mar",
    slogan_en: "Good food, cold beer, ocean people",
    title: "Poke • Baja\nCraft Beer",
    title_en: "",
    lead: "Pesca del día, cerveza de la casa y nada de prisa.",
    lead_en: "Catch of the day, house beer and no rush.",
    hours: "Mar – Dom · 13:30 – 21:30",
    hours_en: "Tue – Sun · 1:30 – 9:30 pm",
    address: "Belisario Domínguez 1251, La Paz",
    address_en: "",
  },
  belt: {
    words: [
      { text: "Poke", text_en: "" },
      { text: "Baja", text_en: "" },
      { text: "Craft Beer", text_en: "" },
      { text: "Pesca del día", text_en: "Catch of the day" },
      { text: "Black Marlin", text_en: "" },
    ],
  },
  build: {
    title: "Arma tu poke",
    title_en: "Build your poke",
    lead: "Seis pasos y tú decides todo. Lo armamos al momento.",
    lead_en: "Six steps and you call the shots. We make it fresh to order.",
    steps: [
      { text: "Elige tu base", text_en: "Choose your base" },
      { text: "Elige tu proteína", text_en: "Choose your protein" },
      { text: "Elige tus mix-ins", text_en: "Choose your mix-ins" },
      { text: "Elige tu salsa", text_en: "Choose your sauce" },
      { text: "Elige tus toppings", text_en: "Choose your toppings" },
      { text: "Crunchies", text_en: "" },
    ],
    cta: "Empezar mi bowl",
    cta_en: "Start my bowl",
    image: unsplash("1604259597308-5321e8e4789c", 1200),
  },
  cravings: {
    title: "¿Qué se te antoja?",
    title_en: "What are you craving?",
    tiles: [
      { image: unsplash("1623428187969-5da2dcea5ebf", 700), text: "Extras", text_en: "", link: "/menu?tab=extras" },
      { image: unsplash("1436076863939-06870fe779c2", 700), text: "Bebidas", text_en: "Drinks", link: "/menu?tab=aguas" },
      { image: unsplash("1535958636474-b021ee887b13", 700), text: "Cerveza craft", text_en: "Craft beer", link: "/menu?tab=beer" },
    ],
  },
  esencia: {
    title: "Nuestra esencia es Baja",
    title_en: "Baja is who we are",
    lead: "Pesca local, poke hecho al momento y cerveza de Black Marlin, nuestra cervecería. Así de simple.",
    lead_en: "Local fish, poke made to order and beer from Black Marlin, our own brewery. Simple as that.",
    image_a: unsplash("1546069901-ba9599a7e63c", 900),
    image_b: unsplash("1535958636474-b021ee887b13", 700),
    cta: "Conoce nuestras cervezas",
    cta_en: "Meet our beers",
  },
  visit: {
    title: "Ven a vernos",
    title_en: "Come see us",
    address: "Belisario Domínguez 1251, CP 23000\nLa Paz, Baja California Sur",
    hours: "Martes a domingo · 13:30 – 21:30\nLunes cerrado",
    hours_en: "Tuesday to Sunday · 1:30 – 9:30 pm\nClosed Mondays",
    cta: "Cómo llegar",
    cta_en: "Get directions",
    email: "hola@blufinpokeco.com",
  },
  footer: {
    brand: "Blufin",
    tagline: "Poke Co · Black Marlin Brewing",
    tagline_en: "",
    city: "La Paz, Baja California Sur",
    copyright: "© 2026 Blufin Poke Co. Todos los derechos reservados.",
    copyright_en: "© 2026 Blufin Poke Co. All rights reserved.",
    // PLACEHOLDER: replace with Blufin's real profiles in /admin.
    social: [
      { network: "instagram", url: "https://instagram.com/" },
      { network: "facebook", url: "https://facebook.com/" },
      { network: "tiktok", url: "https://tiktok.com/" },
    ],
    email: "hola@blufinpokeco.com",
  },
};

/** Google Maps for an address typed in /admin: the embedded map, and the "Cómo llegar" link. */
export const mapsFor = (address: string) => {
  const q = encodeURIComponent(address.replace(/\s*\n\s*/g, ", "));
  return { embed: `https://maps.google.com/maps?q=${q}&z=15&output=embed`, link: `https://maps.google.com/?q=${q}` };
};
