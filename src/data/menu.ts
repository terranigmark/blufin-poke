// Single source of truth for everything the restaurant may need to edit:
// menu items, prices, photos, contact info and social links.
//
// Values marked "PLACEHOLDER" were guessed during design and still need to be
// confirmed by Blufin (see design/chats/chat1.md).

export const unsplash = (id: string, w = 600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&auto=format&fit=crop&q=70`;

// ---------------------------------------------------------------- Business

export const BUSINESS = {
  name: "Blufin Poke Co",
  email: "hola@blufinpokeco.com",
  addressShort: "Belisario Domínguez 1251, La Paz",
  addressLines: ["Belisario Domínguez 1251, CP 23000", "La Paz, Baja California Sur"],
  hoursShort: "Mar – Dom · 13:30 – 21:30",
  hoursLines: ["Martes a domingo · 13:30 – 21:30", "Lunes cerrado"],
  mapsEmbed:
    "https://maps.google.com/maps?q=Belisario%20Dominguez%201251%2C%20La%20Paz%2C%20Baja%20California%20Sur&z=15&output=embed",
  mapsLink: "https://maps.google.com/?q=Belisario+Dominguez+1251+La+Paz+BCS",
  // PLACEHOLDER: replace with Blufin's real profiles.
  social: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://tiktok.com/",
  },
};

// ---------------------------------------------------------------- Photos

export const PHOTOS = {
  bowl: (w = 1200) => unsplash("1604259597308-5321e8e4789c", w),
  esenciaBowl: unsplash("1546069901-ba9599a7e63c", 900),
  esenciaBeer: unsplash("1535958636474-b021ee887b13", 700),
  doneBeach: unsplash("1473116763249-2faaef81ccda", 2000),
  menuBar: unsplash("1514933651103-005eec06c04b", 2000),
  tileExtras: unsplash("1623428187969-5da2dcea5ebf", 700),
  tileDrinks: unsplash("1436076863939-06870fe779c2", 700),
  tileBeer: unsplash("1535958636474-b021ee887b13", 700),
  tvBeer: unsplash("1535958636474-b021ee887b13", 1200),
  tvAguas: unsplash("1436076863939-06870fe779c2", 1200),
  tvNac: unsplash("1514933651103-005eec06c04b", 1200),
};

// ---------------------------------------------------------------- Poke builder

export type StepKey = "base" | "protein" | "mix" | "salsa" | "top" | "crunch";

export type StepOption = { id: string; name: string; img: string | null };

export type Step = {
  key: StepKey;
  /** Label used in summaries and the order ticket. */
  short: string;
  title: string;
  /** Rule shown on the TV menu. */
  tvRule: string;
  min: number;
  /** `Infinity` = no limit. */
  max: number;
  /** Photo steps show large image cards; the rest are name-only cards. */
  photo: boolean;
  opts: StepOption[];
};

const opt = (id: string, name: string, photoId?: string, w = 300): StepOption => ({
  id,
  name,
  img: photoId ? unsplash(photoId, w) : null,
});

export const STEPS: Step[] = [
  {
    key: "base",
    short: "Base",
    title: "Elige tu base",
    tvRule: "Elige 1",
    min: 1,
    max: 1,
    photo: true,
    opts: [
      opt("arroz", "Arroz sushi", "1516684732162-798a0062be99", 500),
      opt("ensalada", "Ensalada", "1540420773420-3366772f4999", 500),
      opt("totopos", "Totopos", "1582169296194-e4d644c48063", 500),
      opt("mitad", "50/50", "1512621776951-a57141f2eefd", 500),
    ],
  },
  {
    key: "protein",
    short: "Proteína",
    title: "Elige tu proteína",
    tvRule: "Hasta 2 · la 2ª +$25",
    min: 1,
    max: 2,
    photo: true,
    opts: [
      opt("pesca", "Pesca del día", "1534604973900-c43ab4c2e0ab", 500),
      opt("atun", "Atún", "1579584425555-c3ce17fd4351", 500),
      opt("atunspicy", "Atún Spicy", "1617196034183-421b4917c92d", 500),
      opt("camaron", "Camarón", "1565680018434-b513d5e5fd47", 500),
      opt("tofu", "Tofu", "1604908176997-125f25cc6f3d", 500),
    ],
  },
  {
    key: "mix",
    short: "Mix-ins",
    title: "Elige tus mix-ins",
    tvRule: "Los que quieras",
    min: 0,
    max: Infinity,
    photo: false,
    opts: [
      opt("cilantro", "Cilantro"),
      opt("cebmorada", "Cebolla morada", "1618512496248-a07fe83aa8cb"),
      opt("cebblanca", "Cebolla blanca", "1580201092675-a0a6a6cafbb1"),
      opt("cebollin", "Cebollín"),
      opt("jalapeno", "Chile jalapeño"),
      opt("ajonjoli", "Ajonjolí"),
    ],
  },
  {
    key: "salsa",
    short: "Salsa",
    title: "Elige tu salsa",
    tvRule: "Recomendamos 2",
    min: 1,
    max: Infinity,
    photo: false,
    opts: [
      opt("spicymayo", "Spicy Mayo"),
      opt("shoyu", "Shoyu"),
      opt("citrusponzu", "Citrus Ponzu", "1590502593747-42a996133562"),
      opt("gingerponzu", "Ginger Ponzu"),
      opt("teriyaki", "Teriyaki"),
      opt("jalshoyu", "Jalapeño Shoyu"),
      opt("gingergarlic", "Ginger Garlic Evoo", "1540148426945-6cf22a6b2383"),
      opt("aceiteajonjoli", "Aceite de Ajonjolí", "1474979266404-7eaacbcd87c5"),
      opt("jalmonster", "Jalapeño Monster"),
    ],
  },
  {
    key: "top",
    short: "Toppings",
    title: "Elige tus toppings",
    tvRule: "Los que quieras",
    min: 0,
    max: Infinity,
    photo: false,
    opts: [
      opt("aguacate", "Aguacate", "1519162808019-7de1683fa2ad"),
      opt("enscangrejo", "Ensalada de cangrejo"),
      opt("edamame", "Edamames"),
      opt("cherry", "Tomate cherry", "1546094096-0df4bcaaa337"),
      opt("zanahoria", "Zanahoria", "1598170845058-32b9d6a5da37"),
      opt("wakame", "Alga wakame"),
      opt("col", "Col morada"),
      opt("germinado", "Germinado"),
      opt("pepino", "Pepino", "1449300079323-02e209d9d3a6"),
      opt("fruta", "Fruta de temporada", "1619566636858-adf3ef46400b"),
    ],
  },
  {
    key: "crunch",
    short: "Crunchies",
    title: "Crunchies",
    tvRule: "Los que quieras",
    min: 0,
    max: Infinity,
    photo: false,
    opts: [
      opt("cebcrispy", "Cebolla crispy", "1639024471283-03518883512d"),
      opt("hotcheetos", "Hot Cheetos"),
      opt("macadamia", "Nueces de macadamia"),
      opt("totopos", "Totopos", "1513456852971-30c0b8199d4d"),
      opt("jengibre", "Jengibre"),
    ],
  },
];

/** Shown when a second protein is picked. */
export const SECOND_PROTEIN_PRICE = 25;
/** From this many salsas on, a "we recommend up to 2" note appears. */
export const SALSA_RECOMMENDED_MAX = 2;
export const PROTEIN_NOTE = "* Proteínas sujetas a cambio y/o hasta agotar existencias";

// PLACEHOLDER: bowl prices were invented in the design.
export const SIZES = [
  { id: "small", name: "Small", price: 165 },
  { id: "regular", name: "Regular", price: 235 },
] as const;
export type SizeId = (typeof SIZES)[number]["id"];

/** Paid extras offered on the "Así queda tu bowl" screen and the TV menu. */
export const BOWL_EXTRAS = [
  { id: "xprot", name: "Proteína", price: 25 },
  { id: "xagu", name: "Aguacate", price: 20 },
  { id: "xwak", name: "Wakame", price: 20 },
  { id: "xcan", name: "Cangrejo", price: 20 },
];

// ---------------------------------------------------------------- Drinks

export type Beer = {
  tap: string;
  name: string;
  style: string;
  abv: string;
  /** PLACEHOLDER: 12 oz prices were guessed as $20 below the 16 oz price. */
  price12: number;
  price16: number;
  /** Dot colour on the menu tap list. */
  color: string;
  desc: string;
};

export const BEERS: Beer[] = [
  { tap: "01", name: "American Stout", style: "Stout", abv: "5.2%", price12: 100, price16: 120, color: "#2A1810", desc: "Café tostado, cacao amargo y cuerpo sedoso." },
  { tap: "02", name: "Pastry Porter", style: "Porter", abv: "6.2%", price12: 70, price16: 90, color: "#3B2216", desc: "Vainilla, chocolate y un final dulce de postre." },
  { tap: "03", name: "Hazy Baby IPA", style: "Hazy IPA", abv: "7.12%", price12: 70, price16: 90, color: "#E8B84A", desc: "Jugosa y turbia, con notas de mango y durazno." },
  { tap: "04", name: "Coastal Dream IPA", style: "IPA", abv: "6.9%", price12: 70, price16: 90, color: "#D99A2B", desc: "Cítrica y resinosa, como brisa de costa." },
  { tap: "05", name: "Baby IPA", style: "Session IPA", abv: "5.4%", price12: 70, price16: 90, color: "#E0A93A", desc: "Ligera y aromática, para toda la tarde." },
  { tap: "06", name: "Angry Belga", style: "Belgian Ale", abv: "4.9%", price12: 70, price16: 90, color: "#C8822B", desc: "Levadura belga, especiada y frutal." },
  { tap: "07", name: "American Lager", style: "Lager", abv: "3.4%", price12: 70, price16: 90, color: "#F0CF6A", desc: "Limpia y refrescante, hecha para el calor." },
  { tap: "08", name: "West Coast Mexican Lager", style: "Lager", abv: "5.4%", price12: 70, price16: 90, color: "#EBC150", desc: "Crujiente, con lúpulo estilo costa oeste." },
];

// PLACEHOLDER: "Botella" vs "Lata" was guessed.
export type Packaged = { name: string; price: number; size: string; pack: "Botella" | "Lata" };

export const AGUAS: Packaged[] = [
  { name: "Agua mineral", price: 40, size: "355 ml", pack: "Botella" },
  { name: "Agua de coco", price: 40, size: "330 ml", pack: "Lata" },
  { name: "Agua natural", price: 15, size: "500 ml", pack: "Botella" },
  { name: "Té gasificado", price: 60, size: "355 ml", pack: "Lata" },
  { name: "Refresco", price: 40, size: "355 ml", pack: "Lata" },
  { name: "Agua de sabor", price: 40, size: "500 ml", pack: "Botella" },
  { name: "Té frío", price: 40, size: "500 ml", pack: "Botella" },
  { name: "Cold brew", price: 75, size: "355 ml", pack: "Lata" },
  { name: "Kombucha", price: 80, size: "355 ml", pack: "Botella" },
  { name: "Soda Orita", price: 65, size: "355 ml", pack: "Lata" },
];

export const NACIONAL: Packaged[] = [
  { name: "Pacífico", price: 35, size: "210 ml", pack: "Botella" },
  { name: "Coronita", price: 35, size: "210 ml", pack: "Botella" },
  { name: "Modelo", price: 50, size: "355 ml", pack: "Lata" },
];

/** Full extras list for the Menú page. */
export const MENU_EXTRAS = [
  { name: "Proteína", price: 25 },
  { name: "Aguacate", price: 20 },
  { name: "Wakame", price: 20 },
  { name: "Toppings", price: 15 },
  { name: "Crunchies", price: 10 },
  { name: "Cangrejo", price: 20 },
  { name: "Salsa", price: 10 },
  { name: "Arroz / ensalada / totopos", price: 50 },
];

// Drinks as orderable items in the "Agrega una bebida" step.
export type DrinkCat = "beer" | "nac" | "aguas";
export type Drink = {
  id: string;
  cat: DrinkCat;
  name: string;
  meta: string;
  sizes: { k: string; label: string; price: number }[];
};

export const DRINKS: Drink[] = [
  ...BEERS.map((b) => ({
    id: "b" + b.tap,
    cat: "beer" as const,
    name: b.name,
    meta: `De barril · ${b.style} · ${b.abv}`,
    sizes: [
      { k: "12", label: "12 oz", price: b.price12 },
      { k: "16", label: "16 oz", price: b.price16 },
    ],
  })),
  ...NACIONAL.map((a, i) => ({
    id: "n" + i,
    cat: "nac" as const,
    name: a.name,
    meta: `${a.pack} · ${a.size}`,
    sizes: [{ k: "u", label: "", price: a.price }],
  })),
  ...AGUAS.map((a, i) => ({
    id: "a" + i,
    cat: "aguas" as const,
    name: a.name,
    meta: `${a.pack} · ${a.size}`,
    sizes: [{ k: "u", label: "", price: a.price }],
  })),
];

export const DRINK_TABS: [DrinkCat, string][] = [
  ["beer", "Cerveza artesanal"],
  ["nac", "Cerveza nacional"],
  ["aguas", "Aguas y refrescos"],
];

export const money = (n: number) => "$" + n;
