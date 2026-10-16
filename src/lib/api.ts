"use client";

// The Django backend (backend/): the live menu the site shows, and the editor at /login.

import { useEffect, useState } from "react";
import { BEERS as BUNDLED_BEERS, EN, MENU, STEPS, drinksFrom, type Menu, type StepKey } from "@/data/menu";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.blufinpoke.com").replace(/\/$/, "");

// ---------------------------------------------------------------- Rows as the API sends them

type Row = { id: number; name: string; name_en: string; available: boolean; order: number };
export type SizeRow = Row & { key: string; price: number };
export type IngredientRow = Row & { step: StepKey; key: string; image_url: string };
export type ExtraRow = Row & { key: string; price: number; in_builder: boolean };
export type BeerRow = Row & {
  tap: string;
  style: string;
  abv: string;
  price_12: number;
  price_16: number;
  color: string;
  description: string;
  description_en: string;
};
export type DrinkRow = Row & { category: "aguas" | "nacional"; price: number; size: string; pack: "Botella" | "Lata" };

export type MenuRows = {
  sizes: SizeRow[];
  ingredients: IngredientRow[];
  extras: ExtraRow[];
  beers: BeerRow[];
  drinks: DrinkRow[];
};
export type Kind = keyof MenuRows;

/** API rows → the shapes src/data/menu.ts exports, so pages need no other change. */
// English left blank in the editor (or a backend without it yet) falls back to the bundled
// translation of the same Spanish text, and only then to the Spanish itself.
const en = (name: string, name_en?: string) => name_en || EN[name];
const ingredientEn = (i: IngredientRow) =>
  i.name_en || (STEPS.find((st) => st.key === i.step)?.opts.find((o) => o.id === i.key && o.name === i.name)?.nameEn ?? EN[i.name]);

export function toMenu(m: MenuRows): Menu {
  const packaged = (cat: DrinkRow["category"]) =>
    m.drinks.filter((d) => d.category === cat).map(({ name, name_en, price, size, pack }) => ({ name, nameEn: en(name, name_en), price, size, pack }));
  const BEERS = m.beers.map((b) => ({
    tap: b.tap,
    name: b.name,
    nameEn: en(b.name, b.name_en),
    style: b.style,
    abv: b.abv,
    price12: b.price_12,
    price16: b.price_16,
    color: b.color,
    desc: b.description,
    descEn: b.description_en || BUNDLED_BEERS.find((x) => x.desc === b.description)?.descEn,
  }));
  const AGUAS = packaged("aguas");
  const NACIONAL = packaged("nacional");
  return {
    SIZES: m.sizes.map((z) => ({ id: z.key, name: z.name, nameEn: en(z.name, z.name_en), price: z.price })),
    STEPS: STEPS.map((st) => ({
      ...st,
      opts: m.ingredients
        .filter((i) => i.step === st.key)
        .map((i) => ({ id: i.key, name: i.name, nameEn: ingredientEn(i), img: i.image_url || null })),
    })),
    BOWL_EXTRAS: m.extras.filter((e) => e.in_builder).map((e) => ({ id: e.key || `x${e.id}`, name: e.name, nameEn: en(e.name, e.name_en), price: e.price })),
    MENU_EXTRAS: m.extras.map(({ name, name_en, price }) => ({ name, nameEn: en(name, name_en), price })),
    BEERS,
    AGUAS,
    NACIONAL,
    DRINKS: drinksFrom(BEERS, NACIONAL, AGUAS),
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
