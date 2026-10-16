"use client";

// The Django backend (backend/): the live menu the site shows, and the editor at /login.

import { useEffect, useState } from "react";
import { BEERS as BUNDLED_BEERS, EN, LISTS, MENU, STEPS, drinkTabs, drinksFrom, orderable, secondProteinPrice, type Menu, type PriceList, type Status, type StepKey } from "@/data/menu";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.blufinpoke.com").replace(/\/$/, "");

// ---------------------------------------------------------------- Rows as the API sends them

type Row = { id: number; name: string; name_en: string; available: boolean; status?: Status; order: number };
export type SizeRow = Row & { key: string; price: number };
export type IngredientRow = Row & { step: StepKey; key: string; image_url: string };
export type ExtraRow = Row & { key: string; price: number; in_builder: boolean };
export type BeerRow = Row & {
  tap: string;
  style: string;
  abv: string;
  price_12: number;
  price_16: number;
  srm: number;
  description: string;
  description_en: string;
};
export type BowlRow = Row & { price: number; description: string; description_en: string; image_url: string };
export type DrinkRow = Row & { category: string; price: number; size: string; pack: "Botella" | "Lata" | "" };
export type CategoryRow = {
  id: number;
  key: string;
  kind: "sizes" | "ingredients" | "extras" | "beers" | "drinks";
  group: "poke" | "drinks" | "others";
  name: string;
  name_en: string;
  available: boolean;
  order: number;
  builtin: boolean;
};

export type MenuRows = {
  sizes: SizeRow[];
  ingredients: IngredientRow[];
  extras: ExtraRow[];
  beers: BeerRow[];
  drinks: DrinkRow[];
  bowls: BowlRow[];
  /** The editor's sections; a backend from before them has none. */
  categories?: CategoryRow[];
};
export type Kind = Exclude<keyof MenuRows, "categories">;

/** API rows → the shapes src/data/menu.ts exports, so pages need no other change. */
// English left blank in the editor (or a backend without it yet) falls back to the bundled
// translation of the same Spanish text, and only then to the Spanish itself.
const en = (name: string, name_en?: string) => name_en || EN[name];
const ingredientEn = (i: IngredientRow) =>
  i.name_en || (STEPS.find((st) => st.key === i.step)?.opts.find((o) => o.id === i.key && o.name === i.name)?.nameEn ?? EN[i.name]);

export function toMenu(m: MenuRows): Menu {
  const packaged = (cat: string) =>
    m.drinks.filter((d) => d.category === cat).map(({ name, name_en, price, size, pack, status }) => ({ name, nameEn: en(name, name_en), price, size, pack, status }));
  // A list the editor hid leaves the menu and Arma tu poke.
  const shown = (key: string) => m.categories?.find((c) => c.key === key)?.available !== false;
  const lists: PriceList[] = m.categories
    ? [...m.categories]
        .filter((c) => c.kind === "drinks" && c.available)
        .sort((a, b) => a.order - b.order || a.id - b.id)
        .map((c) => ({ key: c.key, name: c.name, nameEn: c.name_en || undefined, group: c.group === "others" ? "others" : "drinks", items: packaged(c.key) }))
    : LISTS.map((l) => ({ ...l, items: packaged(l.key) }));
  const BEERS = (shown("beers") ? m.beers : []).map((b) => ({
    tap: b.tap,
    name: b.name,
    nameEn: en(b.name, b.name_en),
    style: b.style,
    abv: b.abv,
    price12: b.price_12,
    price16: b.price_16,
    srm: b.srm,
    desc: b.description,
    descEn: b.description_en || BUNDLED_BEERS.find((x) => x.desc === b.description)?.descEn,
    status: b.status,
  }));
  const AGUAS = shown("aguas") ? packaged("aguas") : [];
  const NACIONAL = shown("nacional") ? packaged("nacional") : [];
  const orderableLists = lists.map((l) => ({ ...l, items: l.items.filter(orderable) }));
  return {
    SIZES: m.sizes.map((z) => ({ id: z.key, name: z.name, nameEn: en(z.name, z.name_en), price: z.price, status: z.status })),
    STEPS: STEPS.map((st) => ({
      ...st,
      opts: m.ingredients
        .filter((i) => i.step === st.key && orderable(i))
        .map((i) => ({ id: i.key, name: i.name, nameEn: ingredientEn(i), img: i.image_url || null })),
    })),
    // Arma tu poke only offers what can be ordered now; /menu lists everything with its badge.
    BOWL_EXTRAS: m.extras.filter((e) => e.in_builder && orderable(e)).map((e) => ({ id: e.key || `x${e.id}`, name: e.name, nameEn: en(e.name, e.name_en), price: e.price })),
    SECOND_PROTEIN_PRICE: secondProteinPrice(m.extras.map((e) => ({ ...e, id: e.key }))),
    MENU_EXTRAS: m.extras.map(({ name, name_en, price, status }) => ({ name, nameEn: en(name, name_en), price, status })),
    BEERS,
    AGUAS,
    NACIONAL,
    LISTS: lists,
    DRINKS: drinksFrom(BEERS.filter(orderable), orderableLists),
    DRINK_TABS: drinkTabs(lists),
    // `?? []`: a backend from before house bowls simply has none.
    HOUSE_BOWLS: (m.bowls ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      nameEn: b.name_en || undefined,
      desc: b.description,
      descEn: b.description_en || undefined,
      price: b.price,
      img: b.image_url || null,
      status: b.status,
    })),
  };
}

// One request per page load, shared by every component that asks.
let live: Promise<Menu> | null = null;
let liveMenu: Menu | null = null;

/** The live menu; shows the bundled one until the API answers, and keeps it if the API is down. */
export function useMenu(): Menu {
  const [menu, setMenu] = useState<Menu>(liveMenu ?? MENU);
  useEffect(() => {
    live ??= fetch(`${API_URL}/api/menu/`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((rows: MenuRows) => (liveMenu = toMenu(rows)));
    live.then(setMenu, () => {
      live = null; // try again on the next page
    });
  }, []);
  return menu;
}

// ---------------------------------------------------------------- Editor auth (same scheme as Cervesoft's taplist-admin)

const ACCESS = "blufin.access";
const REFRESH = "blufin.refresh";
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {}
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** First readable message from a DRF error body: {"detail": ...} or {"field": ["..."]}. */
async function errorFrom(r: Response): Promise<ApiError> {
  let msg = r.status >= 500 ? "El servidor no respondió. Intenta de nuevo en un momento." : `Error ${r.status}`;
  try {
    const body = await r.json();
    const first = body.detail ?? Object.values(body)[0];
    if (first) msg = Array.isArray(first) ? String(first[0]) : String(first);
  } catch {}
  return new ApiError(r.status, msg);
}

export const isSignedIn = () => !!store.get(REFRESH);

export function signOut() {
  store.set(ACCESS, null);
  store.set(REFRESH, null);
}

export async function signIn(email: string, password: string) {
  const r = await fetch(`${API_URL}/api/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    const err = await errorFrom(r);
    if (r.status === 401) err.message = "Correo o contraseña incorrectos.";
    if (r.status === 429) err.message = "Demasiados intentos. Espera un minuto e intenta de nuevo.";
    throw err;
  }
  const data = await r.json();
  store.set(ACCESS, data.access);
  store.set(REFRESH, data.refresh);
}

async function refreshAccess() {
  const r = await fetch(`${API_URL}/api/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: store.get(REFRESH) }),
  });
  if (!r.ok) {
    signOut();
    throw new ApiError(401, "Tu sesión expiró. Vuelve a entrar.");
  }
  store.set(ACCESS, (await r.json()).access);
}

/** Authenticated call to the editor API; refreshes the 30-minute access token once when it has expired. */
export async function editorFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const r = await fetch(`${API_URL}/api/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${store.get(ACCESS)}`, ...init.headers },
  });
  if (r.status === 401 && retry) {
    await refreshAccess();
    return editorFetch(path, init, false);
  }
  if (!r.ok) throw await errorFrom(r);
  return (r.status === 204 ? null : await r.json()) as T;
}
