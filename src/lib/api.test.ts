import { describe, expect, it, vi } from "vitest";
import { MENU } from "@/data/menu";
import { ApiError, API_URL, editorFetch, isSignedIn, signIn, signOut, toMenu, type MenuRows } from "./api";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const ROWS: MenuRows = {
  sizes: [{ id: 1, key: "small", name: "Small", name_en: "", price: 170, available: true, order: 0 }],
  ingredients: [
    { id: 2, step: "base", key: "arroz", name: "Arroz", name_en: "", image_url: "", available: true, order: 0 },
    { id: 3, step: "crunch", key: "totopos", name: "Totopos", name_en: "", image_url: "https://x/t.jpg", available: true, order: 0 },
  ],
  extras: [
    { id: 4, key: "xagu", name: "Aguacate", name_en: "", price: 20, in_builder: true, available: true, order: 0 },
    { id: 5, key: "", name: "Salsa", name_en: "", price: 10, in_builder: false, available: true, order: 1 },
  ],
  beers: [{ id: 6, tap: "01", name: "Stout", name_en: "", style: "Stout", abv: "5%", price_12: 70, price_16: 90, color: "#000", description: "Rica", description_en: "", available: true, order: 0 }],
  drinks: [
    { id: 7, category: "aguas", name: "Agua", name_en: "", price: 15, size: "500 ml", pack: "Botella", available: true, order: 0 },
    { id: 8, category: "nacional", name: "Modelo", name_en: "", price: 50, size: "355 ml", pack: "Lata", available: true, order: 0 },
  ],
};

describe("toMenu", () => {
  it("turns API rows into the shapes the pages use", () => {
    const m = toMenu(ROWS);
    expect(m.SIZES).toEqual([{ id: "small", name: "Small", price: 170 }]);
    expect(m.STEPS.map((s) => s.key)).toEqual(MENU.STEPS.map((s) => s.key));
    expect(m.STEPS[0].opts).toEqual([{ id: "arroz", name: "Arroz", img: null }]);
    expect(m.STEPS[5].opts).toEqual([{ id: "totopos", name: "Totopos", nameEn: "Tortilla chips", img: "https://x/t.jpg" }]);
    // Only builder extras are offered in Arma tu poke; the menu lists them all.
    expect(m.BOWL_EXTRAS).toEqual([{ id: "xagu", name: "Aguacate", nameEn: "Avocado", price: 20 }]);
    expect(m.MENU_EXTRAS).toHaveLength(2);
    expect(m.BEERS[0]).toMatchObject({ tap: "01", price12: 70, price16: 90, desc: "Rica" });
    expect(m.AGUAS).toEqual([{ name: "Agua", price: 15, size: "500 ml", pack: "Botella" }]);
    expect(m.NACIONAL[0].name).toBe("Modelo");
    expect(m.DRINKS.map((d) => d.id)).toEqual(["b01", "n0", "a0"]);
  });
});

describe("toMenu statuses", () => {
  it("keeps every status on the menu lists but leaves sold-out and coming-soon items out of Arma tu poke", () => {
    const m = toMenu({
      ...ROWS,
      sizes: [{ ...ROWS.sizes[0], status: "agotado" }],
      ingredients: [{ ...ROWS.ingredients[0], status: "agotado" }, { ...ROWS.ingredients[1], status: "novedad" }],
      extras: [{ ...ROWS.extras[0], status: "proximamente" }, ROWS.extras[1]],
      beers: [{ ...ROWS.beers[0], status: "agotado" }],
      drinks: [{ ...ROWS.drinks[0], status: "por_agotarse" }, ROWS.drinks[1]],
    });
    expect(m.SIZES[0].status).toBe("agotado");
    expect(m.BEERS[0].status).toBe("agotado");
    expect(m.AGUAS[0].status).toBe("por_agotarse");
    expect(m.MENU_EXTRAS.map((e) => e.status)).toEqual(["proximamente", undefined]);
    expect(m.STEPS[0].opts).toEqual([]);
    expect(m.STEPS[5].opts.map((o) => o.id)).toEqual(["totopos"]);
    expect(m.BOWL_EXTRAS).toEqual([]);
    expect(m.DRINKS.map((d) => d.id)).toEqual(["n0", "a0"]);
  });
});

describe("editor auth", () => {
  it("stores the token pair on sign-in and forgets it on sign-out", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ access: "a1", refresh: "r1" }));
    vi.stubGlobal("fetch", fetch);
    await signIn("mesera@blufin.mx", "clave");
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/api/auth/login/`, expect.objectContaining({ method: "POST" }));
    expect(isSignedIn()).toBe(true);
    signOut();
    expect(isSignedIn()).toBe(false);
  });

  it.each([
    [401, { detail: "No active account" }, "Correo o contraseña incorrectos."],
    [403, { detail: "Esta cuenta no tiene acceso al editor del menú." }, "Esta cuenta no tiene acceso al editor del menú."],
    [429, { detail: "Throttled" }, "Demasiados intentos. Espera un minuto e intenta de nuevo."],
  ])("explains a %i on sign-in in Spanish", async (status, body, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(body, status)));
    await expect(signIn("x@blufin.mx", "y")).rejects.toMatchObject({ status, message });
    expect(isSignedIn()).toBe(false);
  });

  it("refreshes an expired access token once and retries", async () => {
    localStorage.setItem("blufin.access", "old");
    localStorage.setItem("blufin.refresh", "r1");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ detail: "expired" }, 401))
      .mockResolvedValueOnce(json({ access: "new" }))
      .mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal("fetch", fetch);

    await expect(editorFetch("editor/")).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls[1][0]).toBe(`${API_URL}/api/auth/refresh/`);
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe("Bearer new");
  });

  it("signs out when the refresh token is no longer valid", async () => {
    localStorage.setItem("blufin.refresh", "r1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({}, 401)));
    await expect(editorFetch("editor/")).rejects.toBeInstanceOf(ApiError);
    expect(isSignedIn()).toBe(false);
  });

  it("surfaces the first field error from the API", async () => {
    localStorage.setItem("blufin.refresh", "r1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ price: ["Ingrese un número válido."] }, 400)));
    await expect(editorFetch("editor/sizes/1/", { method: "PATCH" })).rejects.toMatchObject({ status: 400, message: "Ingrese un número válido." });
  });

  it("returns null for an empty 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(editorFetch("editor/beers/1/", { method: "DELETE" })).resolves.toBeNull();
  });
});

describe("toMenu English names", () => {
  it("carries the English name and description from the API", () => {
    const rows: MenuRows = {
      ...ROWS,
      ingredients: [{ ...ROWS.ingredients[0], name: "Atún", name_en: "Tuna" }],
      beers: [{ ...ROWS.beers[0], description_en: "Tasty" }],
    };
    const m = toMenu(rows);
    expect(m.STEPS[0].opts[0]).toMatchObject({ name: "Atún", nameEn: "Tuna" });
    expect(m.STEPS[0].en.title).toBe("Choose your base");
    expect(m.BEERS[0]).toMatchObject({ desc: "Rica", descEn: "Tasty" });
    expect(m.AGUAS[0].nameEn).toBeUndefined(); // no English anywhere: the page shows the Spanish
    expect(m.DRINKS.find((d) => d.id === "n0")).toMatchObject({ meta: "Lata · 355 ml", metaEn: "Can · 355 ml" });
  });
});

it("falls back to the bundled English when the API has none (blank, or a backend without the field)", () => {
  const rows = {
    ...ROWS,
    ingredients: [
      { id: 2, step: "base", key: "totopos", name: "Totopos", image_url: "", available: true, order: 0 },
      { id: 3, step: "crunch", key: "totopos", name: "Totopos", image_url: "", available: true, order: 0 },
      { id: 4, step: "salsa", key: "shoyu", name: "Shoyu", name_en: "", image_url: "", available: true, order: 0 },
    ],
    beers: [{ ...ROWS.beers[0], description: "Café tostado, cacao amargo y cuerpo sedoso.", description_en: "" }],
  } as MenuRows;
  const m = toMenu(rows);
  expect(m.STEPS[0].opts[0].nameEn).toBe("Nachos");
  expect(m.STEPS[5].opts[0].nameEn).toBe("Tortilla chips");
  expect(m.STEPS[3].opts[0].nameEn).toBe("Secret Shoyu");
  expect(m.BEERS[0].descEn).toBe("Roasted coffee, bitter cocoa and a silky body.");
  expect(m.BOWL_EXTRAS[0].nameEn).toBe("Avocado"); // "Aguacate" with name_en ""
});
