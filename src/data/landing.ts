// The home page's editable content, as /admin's "Página de inicio" cards save it (backend Landing).
// This copy is what the site shows until the API answers, or if it's down; backend
// migration 0007 seeded the same.

export type Word = { text: string; text_en: string };

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
};
