// The home page's editable content, as /admin's "Página de inicio" cards save it (backend Landing).
// This copy is what the site shows until the API answers, or if it's down; backend
// migrations 0007 and 0008 seeded the same.

import { unsplash } from "./menu";

export type Word = { text: string; text_en: string };
export type Tile = Word & { image: string; link: string };

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
};
