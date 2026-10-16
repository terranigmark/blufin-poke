import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LANDING, type Landing } from "@/data/landing";
import { API_URL, type CategoryRow, type MenuRows } from "@/lib/api";
import { AdminPage, LoginPage, ResetPasswordPage } from "./Editor";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const signedIn = () => {
  localStorage.setItem("blufin.access", "a1");
  localStorage.setItem("blufin.refresh", "r1");
};

const ROWS: MenuRows = {
  sizes: [{ id: 1, key: "small", name: "Small", name_en: "", price: 165, available: true, order: 0 }],
  ingredients: [],
  extras: [],
  beers: [{ id: 2, tap: "01", name: "American Stout", name_en: "", style: "Stout", abv: "5.2%", price_12: 100, price_16: 120, srm: 40, description: "", description_en: "", available: true, order: 0 }],
  drinks: [],
  bowls: [],
};

/** A fake API: GET editor/ returns ROWS, PATCH echoes the row back merged. */
function api(overrides: (url: string, init?: RequestInit) => Response | undefined = () => undefined) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const hit = overrides(url, init);
    if (hit) return hit;
    if (url === `${API_URL}/api/editor/`) return json(ROWS);
    const m = url.match(/editor\/(\w+)\/(\d+)\/$/);
    if (m && init?.method === "PATCH") {
      const row = (ROWS[m[1] as keyof MenuRows] as { id: number }[]).find((r) => r.id === Number(m[2]));
      return json({ ...row, ...JSON.parse(String(init.body)) });
    }
    return json({ detail: "not found" }, 404);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  replace.mockClear();
  // jsdom's device language is English; these tests read /admin in Spanish unless they switch.
  localStorage.setItem("blufin.lang", "es");
});

describe("/login", () => {
  it("sends a signed-in manager straight to /admin", async () => {
    signedIn();
    render(<LoginPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/"));
    expect(screen.queryByRole("button", { name: "Entrar" })).not.toBeInTheDocument();
  });

  it("signs in and goes to /admin", async () => {
    api((url) => (url.endsWith("/auth/login/") ? json({ access: "a1", refresh: "r1" }) : undefined));
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Correo"), "mesera@blufin.mx");
    await userEvent.type(screen.getByLabelText("Contraseña"), "una-clave-larga-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/"));
    expect(localStorage.getItem("blufin.refresh")).toBe("r1");
  });

  it("shows why sign-in failed and stays on the form", async () => {
    api(() => json({ detail: "No active account" }, 401));
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Correo"), "mesera@blufin.mx");
    await userEvent.type(screen.getByLabelText("Contraseña"), "mala");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("forgot password", () => {
  it("asks for the email and shows the server's answer", async () => {
    const fetch = api((url) => (url.endsWith("/password/forgot/") ? json({ detail: "Si ese correo tiene una cuenta, te llegará un enlace." }) : undefined));
    render(<LoginPage />);
    await userEvent.click(await screen.findByRole("button", { name: "¿Olvidaste tu contraseña?" }));
    await userEvent.type(screen.getByLabelText("Correo"), "mesera@blufin.mx");
    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
    expect(await screen.findByRole("status")).toHaveTextContent("te llegará un enlace");
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ email: "mesera@blufin.mx" });
    await userEvent.click(screen.getByRole("button", { name: "← Volver a entrar" }));
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("sets the new password from the emailed link and clears it from the address bar", async () => {
    window.history.replaceState(null, "", "/login/restablecer/#MQ/abc-123");
    const fetch = api((url) => (url.endsWith("/password/reset/") ? json({ detail: "Listo. Ya puedes entrar con tu nueva contraseña." }) : undefined));
    render(<ResetPasswordPage />);
    await waitFor(() => expect(window.location.hash).toBe(""));
    await userEvent.type(screen.getByLabelText("Contraseña nueva"), "otra-clave-larga-456");
    await userEvent.type(screen.getByLabelText("Repítela"), "otra-distinta-456");
    await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(screen.getByRole("alert")).toHaveTextContent("no son iguales");
    expect(fetch).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText("Repítela"));
    await userEvent.type(screen.getByLabelText("Repítela"), "otra-clave-larga-456");
    await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Listo");
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ uid: "MQ", token: "abc-123", password: "otra-clave-larga-456" });
  });

  it("says when the link was already used or expired", async () => {
    window.history.replaceState(null, "", "/login/restablecer/#MQ/viejo");
    api(() => json({ detail: "Este enlace ya se usó o venció." }, 400));
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText("Contraseña nueva"), "otra-clave-larga-456");
    await userEvent.type(screen.getByLabelText("Repítela"), "otra-clave-larga-456");
    await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ya se usó o venció");
  });
});

describe("/admin", () => {
  it("sends a signed-out visitor to /login", async () => {
    render(<AdminPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login/"));
  });

  it("signs out when the account lost menu access", async () => {
    signedIn();
    api(() => json({ detail: "forbidden" }, 403));
    render(<AdminPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login/"));
    expect(localStorage.getItem("blufin.refresh")).toBeNull();
  });

  it("opens every section and shows Cervesoft's header", async () => {
    signedIn();
    api();
    render(<AdminPage />);
    expect(await screen.findByText("American Stout")).toBeInTheDocument();
    expect(screen.getByText("Small")).toBeInTheDocument();
    expect(screen.getByText(/^2 artículos · \d+ secciones · Guardado$/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver menú público" })).toHaveAttribute("href", expect.stringMatching(/^\/menu\/?$/));

    // Folding a section away, and the search box's clear button.
    await userEvent.click(screen.getByRole("button", { name: /^Cerveza de barril/ }));
    expect(screen.queryByText("American Stout")).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar artículos" }), "stout");
    expect(screen.getByText("American Stout")).toBeInTheDocument();
    expect(screen.queryByText("Small")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    expect(screen.getByText("Small")).toBeInTheDocument();
  });

  it("lets the thumbnail say whether an ingredient has a photo, with no extra label", async () => {
    signedIn();
    const ingredients = [
      { id: 7, step: "base", key: "arroz", name: "Arroz sushi", name_en: "", image_url: "https://x/arroz.jpg", available: true, order: 0 },
      { id: 8, step: "base", key: "totopos", name: "Totopos", name_en: "", image_url: "", available: true, order: 1 },
    ];
    api((url) => (url === `${API_URL}/api/editor/` ? json({ ...ROWS, ingredients }) : undefined));
    render(<AdminPage />);
    const row = (await screen.findByText("Totopos")).closest("li")!;
    expect(row.textContent).toBe("Totopos");
    expect(screen.queryByText(/Con foto|Sin foto/)).not.toBeInTheDocument();
  });

  it("signs out from the header's ⋮ menu", async () => {
    signedIn();
    api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Más" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Salir" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login/"));
    expect(localStorage.getItem("blufin.refresh")).toBeNull();
  });

  it("hides an item from the ⋮ menu", async () => {
    signedIn();
    const fetch = api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de American Stout" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Ocultar del menú" }));

    await screen.findByText("Guardado", { exact: false });
    const [url, init] = fetch.mock.calls.at(-1)!;
    expect(url).toBe(`${API_URL}/api/editor/beers/2/`);
    expect(init).toMatchObject({ method: "PATCH", body: JSON.stringify({ id: 2, available: false }) });
    expect(await screen.findByText(/· Oculto$/)).toBeInTheDocument();
    expect(screen.getByText(/1 oculto$/)).toBeInTheDocument();
  });

  it("edits an item's price in the sheet", async () => {
    signedIn();
    const fetch = api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: /^Small/ }));

    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Editar artículo" })).toBeInTheDocument();
    const price = within(sheet).getByLabelText("Precio (MXN)");
    await userEvent.clear(price);
    await userEvent.type(price, "175");
    await userEvent.click(within(sheet).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [, init] = fetch.mock.calls.at(-1)!;
    expect(JSON.parse(String(init!.body))).toMatchObject({ id: 1, name: "Small", name_en: "", price: 175, available: true, status: "" });
    expect(screen.getByText("$175")).toBeInTheDocument();
  });

  it("sets one status at a time and hides from the sheet's switches", async () => {
    signedIn();
    const fetch = api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: /^Small/ }));
    const sheet = screen.getByRole("dialog");
    const agotado = within(sheet).getByRole("checkbox", { name: /^Agotado/ });
    const novedad = within(sheet).getByRole("checkbox", { name: /^Novedad/ });
    await userEvent.click(agotado);
    await userEvent.click(novedad);
    expect(agotado).not.toBeChecked();
    expect(novedad).toBeChecked();
    await userEvent.click(within(sheet).getByRole("checkbox", { name: /^Oculto/ }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(JSON.parse(String(fetch.mock.calls.at(-1)![1]!.body))).toMatchObject({ id: 1, status: "novedad", available: false });
  });

  it("adds from the section's Añadir and from the round + button", async () => {
    signedIn();
    api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Añadir a Cerveza de barril" }));
    let sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Añadir artículo" })).toBeInTheDocument();
    expect(within(sheet).getByLabelText(/^Grifo/)).toHaveValue("02");
    await userEvent.click(within(sheet).getByRole("button", { name: "Cancelar" }));

    // The round button adds to the section used last.
    await userEvent.click(screen.getByRole("button", { name: "Añadir artículo" }));
    sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText(/^Cerveza de barril ·/)).toBeInTheDocument();
  });

  it("edits a beer's English name and description, which are optional", async () => {
    signedIn();
    const fetch = api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: /^American Stout/ }));

    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByLabelText(/^Nombre en inglés/)).not.toBeRequired();
    await userEvent.type(within(sheet).getByLabelText(/^Descripción en inglés/), "Roasted coffee.");
    await userEvent.click(within(sheet).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [, init] = fetch.mock.calls.at(-1)!;
    expect(JSON.parse(String(init!.body))).toMatchObject({ id: 2, name_en: "", description_en: "Roasted coffee." });
  });

  it("picks a beer's colour on an SRM slider, or by typing the number, with a swatch of it", async () => {
    signedIn();
    const fetch = api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: /^American Stout/ }));

    const sheet = screen.getByRole("dialog");
    const slider = within(sheet).getByRole("slider", { name: "SRM" });
    const number = within(sheet).getByRole("spinbutton", { name: "Número SRM" });
    const swatch = sheet.querySelector('[class*="srmSwatch"]')!;
    expect(slider).toHaveValue("40");
    expect(swatch).toHaveStyle({ background: "#36080A" });

    fireEvent.change(slider, { target: { value: "20" } });
    expect(number).toHaveValue(20);
    // Typing moves the slider and the swatch, and stays within 1 to 40.
    await userEvent.clear(number);
    await userEvent.type(number, "99");
    expect(slider).toHaveValue("40");
    await userEvent.tab();
    expect(number).toHaveValue(40);
    await userEvent.clear(number);
    await userEvent.type(number, "12");
    expect(slider).toHaveValue("12");
    expect(swatch).toHaveStyle({ background: "#CF6900" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(JSON.parse(String(fetch.mock.calls.at(-1)![1]!.body))).toMatchObject({ id: 2, srm: 12 });
  });

  it("lists Cervesoft's actions in the ⋮ menu and closes it with Esc", async () => {
    signedIn();
    api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de American Stout" }));
    const items = within(screen.getByRole("menu")).getAllByRole("menuitem").map((b) => b.textContent);
    expect(items).toEqual([
      "Editar",
      "Duplicar",
      "Marcar como agotado",
      "Marcar como próximamente",
      "Marcar como por agotarse",
      "Marcar como novedad",
      "Ocultar del menú",
      "Eliminar",
    ]);
    // Every option carries an icon, as in Cervesoft.
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").every((b) => b.querySelector("svg"))).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Opciones de American Stout" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    expect(within(screen.getByRole("dialog")).getByLabelText(/^Grifo/)).toHaveValue("01");
  });

  it("marks an item sold out, and Deshacer puts it back", async () => {
    signedIn();
    const fetch = api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de American Stout" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Marcar como agotado" }));

    await screen.findByText(/· Agotado$/);
    expect(fetch.mock.calls.at(-1)![1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ id: 2, status: "agotado" }) });
    // As in Cervesoft, the sold-out line turns into "Marcar como disponible" in the same place.
    await userEvent.click(screen.getByRole("button", { name: "Opciones de American Stout" }));
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem")[2]).toHaveTextContent("Marcar como disponible");
    expect(screen.queryByRole("menuitem", { name: "Marcar como agotado" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(fetch.mock.calls.at(-1)![1]).toMatchObject({ body: JSON.stringify({ id: 2, status: "" }) }));
    await waitFor(() => expect(screen.queryByText(/· Agotado$/)).not.toBeInTheDocument());
  });

  it("duplicates a beer onto the next free tap without its id", async () => {
    signedIn();
    const fetch = api((url, init) => (init?.method === "POST" ? json({ ...JSON.parse(String(init.body)), id: 9 }, 201) : undefined));
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de American Stout" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Duplicar" }));

    expect(await screen.findByText("American Stout (copia)")).toBeInTheDocument();
    const [url, init] = fetch.mock.calls.at(-1)!;
    expect(url).toBe(`${API_URL}/api/editor/beers/`);
    const body = JSON.parse(String(init!.body));
    expect(body).toMatchObject({ name: "American Stout (copia)", tap: "02", style: "Stout", price_16: 120 });
    expect(body).not.toHaveProperty("id");
  });

  it("deletes straight from the ⋮ menu, and Deshacer brings it back", async () => {
    signedIn();
    const fetch = api((url, init) =>
      init?.method === "DELETE" ? new Response(null, { status: 204 }) : init?.method === "POST" ? json({ ...JSON.parse(String(init.body)), id: 9 }, 201) : undefined,
    );
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de American Stout" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Eliminar" }));
    await waitFor(() => expect(screen.queryByText("American Stout")).not.toBeInTheDocument());
    expect(screen.getByText("Eliminaste “American Stout”")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(await screen.findByText("American Stout")).toBeInTheDocument();
    const [url, init] = fetch.mock.calls.at(-1)!;
    expect(url).toBe(`${API_URL}/api/editor/beers/`);
    expect(JSON.parse(String(init!.body))).toMatchObject({ tap: "01", name: "American Stout" });
  });

  it("groups the lists into poke elements, drinks and others, and adds, moves and deletes price lists", async () => {
    signedIn();
    const cat = (id: number, key: string, kind: CategoryRow["kind"], group: CategoryRow["group"], name: string, builtin = true): CategoryRow =>
      ({ id, key, kind, group, name, name_en: "", available: true, order: id, builtin });
    const cats = [cat(1, "sizes", "sizes", "poke", "Tamaños de bowl"), cat(10, "aguas", "drinks", "drinks", "Aguas y refrescos"), cat(12, "postres", "drinks", "others", "Postres", false)];
    const brownie = { id: 5, category: "postres", name: "Brownie", name_en: "", price: 60, size: "", pack: "" as const, available: true, order: 0 };
    const fetch = api((url, init) => {
      if (url === `${API_URL}/api/editor/`) return json({ ...ROWS, categories: cats, drinks: [brownie] });
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (url.endsWith("/editor/categories/") && init?.method === "POST") return json({ ...cat(13, "cocteles", "drinks", "drinks", "", false), ...body }, 201);
      if (url.endsWith("/editor/categories/12/") && init?.method === "PATCH") return json({ ...cats[2], ...body });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
    });
    render(<AdminPage />);
    expect((await screen.findAllByRole("heading", { level: 2 })).map((h) => h.textContent)).toEqual(["Elementos del poke", "Bebidas", "Otros"]);
    // Items in a list that isn't drinks need no bottle or can.
    expect(screen.getByText("Brownie").closest("button")).toHaveTextContent(/^Brownie\$60$/);

    vi.spyOn(window, "prompt").mockReturnValue("Cócteles");
    await userEvent.click(screen.getByRole("button", { name: "Nueva lista en Bebidas" }));
    expect(await screen.findByRole("button", { name: "Añadir a Cócteles" })).toBeInTheDocument();
    expect(JSON.parse(String(fetch.mock.calls.at(-1)![1]!.body))).toEqual({ name: "Cócteles", group: "drinks", order: 13 });

    await userEvent.click(screen.getByRole("button", { name: "Opciones de la lista Postres" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Mover a Bebidas" }));
    await waitFor(() => expect(fetch.mock.calls.at(-1)![1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ id: 12, group: "drinks" }) }));
    expect(await screen.findByText("Aquí van las listas que no son bebidas, como postres. Arma tu poke no las ofrece.")).toBeInTheDocument();

    // The lists the menu ships with can move but not go away.
    await userEvent.click(screen.getByRole("button", { name: "Opciones de la lista Aguas y refrescos" }));
    expect(screen.queryByRole("menuitem", { name: "Eliminar lista" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Opciones de la lista Postres" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Eliminar lista" }));
    await waitFor(() => expect(screen.queryByText("Brownie")).not.toBeInTheDocument());
    expect(confirm).toHaveBeenCalledWith("¿Eliminar la lista “Postres” y sus 1 artículo? No se puede deshacer.");
    expect(fetch.mock.calls.at(-1)![0]).toBe(`${API_URL}/api/editor/categories/12/`);
  });

  it("puts a hidden item back when saving fails", async () => {
    signedIn();
    api((url, init) => (init?.method === "PATCH" ? json({}, 500) : undefined));
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de American Stout" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Ocultar del menú" }));
    expect(await screen.findByText("El servidor no respondió. Intenta de nuevo en un momento.")).toBeInTheDocument();
    expect(screen.queryByText(/· Oculto$/)).not.toBeInTheDocument();
  });

  describe("Página de inicio", () => {
    /** The API's answer to a landing PATCH: the stored content with the sent sections replaced. */
    const landingApi = () => {
      let stored: Landing = LANDING;
      return api((url, init) => {
        if (url !== `${API_URL}/api/editor/landing/`) return undefined;
        stored = { ...stored, ...JSON.parse(String(init!.body)) };
        return json(stored);
      });
    };
    const lastBody = (fetch: ReturnType<typeof api>) => JSON.parse(String(fetch.mock.calls.at(-1)![1]!.body));
    // Every Guardar asks first; these tests say yes unless they say otherwise.
    const confirm = vi.fn(() => true);
    beforeEach(() => {
      confirm.mockClear();
      vi.stubGlobal("confirm", confirm);
    });

    it("asks before publishing, and saying no saves nothing", async () => {
      signedIn();
      const fetch = landingApi();
      confirm.mockReturnValueOnce(false);
      render(<AdminPage />);
      await userEvent.click(await screen.findByRole("tab", { name: "Página de inicio" }));
      const hero = screen.getByRole("form", { name: "Portada" });
      await userEvent.type(within(hero).getByLabelText("Frase"), "!");
      const calls = fetch.mock.calls.length;
      await userEvent.click(within(hero).getByRole("button", { name: "Guardar" }));

      expect(confirm).toHaveBeenCalledWith("¿Publicar los cambios de “Portada” en la página de inicio?");
      expect(fetch.mock.calls).toHaveLength(calls);
      expect(within(hero).getByLabelText("Frase")).toHaveValue(LANDING.hero.slogan + "!"); // the edit stays in the form
    });

    it("saves the hero's texts, and Deshacer puts the old ones back", async () => {
      signedIn();
      const fetch = landingApi();
      render(<AdminPage />);
      await userEvent.click(await screen.findByRole("tab", { name: "Página de inicio" }));
      expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

      const hero = screen.getByRole("form", { name: "Portada" });
      const save = within(hero).getByRole("button", { name: "Guardar" });
      expect(save).toBeDisabled(); // nothing changed yet
      const slogan = within(hero).getByLabelText("Frase");
      expect(slogan).toHaveValue(LANDING.hero.slogan);
      await userEvent.clear(slogan);
      await userEvent.type(slogan, "Olas y poke");
      await userEvent.click(save);

      await screen.findByText("Guardaste la página de inicio");
      expect(lastBody(fetch)).toEqual({ hero: { ...LANDING.hero, slogan: "Olas y poke" } });
      expect(within(screen.getByRole("form", { name: "Portada" })).getByLabelText("Frase")).toHaveValue("Olas y poke");

      await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
      await waitFor(() => expect(within(screen.getByRole("form", { name: "Portada" })).getByLabelText("Frase")).toHaveValue(LANDING.hero.slogan));
      expect(lastBody(fetch)).toEqual({ hero: LANDING.hero });
    });

    it("adds, moves and removes the belt's texts", async () => {
      signedIn();
      const fetch = landingApi();
      render(<AdminPage />);
      await userEvent.click(await screen.findByRole("tab", { name: "Página de inicio" }));
      const belt = screen.getByRole("form", { name: "Franja animada" });

      await userEvent.click(within(belt).getByRole("button", { name: "Quitar texto 1" })); // Poke
      await userEvent.click(within(belt).getByRole("button", { name: "Bajar texto 1" })); // Baja below Craft Beer
      await userEvent.click(within(belt).getByRole("button", { name: "+ Añadir texto" }));
      await userEvent.type(within(belt).getByLabelText("Texto 5"), "Mar");
      await userEvent.type(within(belt).getByLabelText("Texto 5 en inglés"), "Sea");
      await userEvent.click(within(belt).getByRole("button", { name: "Guardar" }));

      await screen.findByText("Guardaste la página de inicio");
      expect(lastBody(fetch).belt.words.map((w: { text: string }) => w.text)).toEqual(["Craft Beer", "Baja", "Pesca del día", "Black Marlin", "Mar"]);
      expect(lastBody(fetch).belt.words[4]).toEqual({ text: "Mar", text_en: "Sea" });
    });

    it("edits Arma tu poke's steps and ¿Qué se te antoja?'s pictures", async () => {
      signedIn();
      const fetch = landingApi();
      render(<AdminPage />);
      await userEvent.click(await screen.findByRole("tab", { name: "Página de inicio" }));

      const build = screen.getByRole("form", { name: "Arma tu poke" });
      await userEvent.click(within(build).getByRole("button", { name: "Quitar paso 6" }));
      await userEvent.click(within(build).getByRole("button", { name: "+ Añadir paso" }));
      await userEvent.type(within(build).getByLabelText("Paso 6"), "Disfruta");
      await userEvent.click(within(build).getByRole("button", { name: "Guardar" }));
      await screen.findByText("Guardaste la página de inicio");
      expect(lastBody(fetch).build.steps.at(-1)).toEqual({ text: "Disfruta", text_en: "" });
      expect(lastBody(fetch).build.steps).toHaveLength(6);

      const cravings = screen.getByRole("form", { name: "¿Qué se te antoja?" });
      await userEvent.click(within(cravings).getByRole("button", { name: "Quitar foto 1" }));
      const link = within(cravings).getByLabelText(/^Enlace 2/);
      await userEvent.clear(link);
      await userEvent.type(link, "/menu?tab=nacional");
      await userEvent.click(within(cravings).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(lastBody(fetch).cravings?.tiles).toHaveLength(2));
      expect(lastBody(fetch).cravings.tiles.map((x: { text: string; link: string }) => `${x.text} ${x.link}`)).toEqual([
        "Bebidas /menu?tab=aguas",
        "Cerveza craft /menu?tab=nacional",
      ]);
    });

    it("adds a social network to the footer and leaves the email empty", async () => {
      signedIn();
      const fetch = landingApi();
      render(<AdminPage />);
      await userEvent.click(await screen.findByRole("tab", { name: "Página de inicio" }));
      const footer = screen.getByRole("form", { name: "Pie de página" });

      await userEvent.click(within(footer).getByRole("button", { name: "+ Añadir red" }));
      await userEvent.selectOptions(within(footer).getByLabelText("Red 4"), "WhatsApp");
      await userEvent.type(within(footer).getByLabelText(/^Enlace 4/), "https://wa.me/526120000000");
      await userEvent.clear(within(footer).getByLabelText(/^Correo/));
      await userEvent.click(within(footer).getByRole("button", { name: "Guardar" }));

      await screen.findByText("Guardaste la página de inicio");
      expect(lastBody(fetch).footer.social.at(-1)).toEqual({ network: "whatsapp", url: "https://wa.me/526120000000" });
      expect(lastBody(fetch).footer.email).toBe("");
    });

    it("uploads a new hero video, and Quitar leaves the picture alone", async () => {
      signedIn();
      const fetch = landingApi();
      render(<AdminPage />);
      await userEvent.click(await screen.findByRole("tab", { name: "Página de inicio" }));
      const hero = screen.getByRole("form", { name: "Portada" });

      fetch.mockImplementationOnce(async () => json({ src: "/api/media/7/" }, 201));
      await userEvent.upload(within(hero).getByLabelText("Video: subir archivo"), new File(["mp4"], "olas.mp4", { type: "video/mp4" }));
      await waitFor(() => expect(hero.querySelector("video")).toHaveAttribute("src", `${API_URL}/api/media/7/`));
      const [url, init] = fetch.mock.calls.at(-1)!;
      expect(url).toBe(`${API_URL}/api/editor/media/`);
      expect(JSON.parse(String(init!.body)).file).toMatch(/^data:video\/mp4;base64,/);

      await userEvent.click(within(hero).getByRole("button", { name: "Guardar" }));
      await screen.findByText("Guardaste la página de inicio");
      expect(lastBody(fetch).hero).toMatchObject({ video: "/api/media/7/", image: LANDING.hero.image });

      // Quitar the video: the picture shows alone.
      const saved = screen.getByRole("form", { name: "Portada" });
      await userEvent.click(within(saved).getAllByRole("button", { name: "Quitar" })[1]);
      await userEvent.click(within(saved).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(lastBody(fetch).hero).toMatchObject({ video: "", image: LANDING.hero.image }));
    });
  });
});

describe("/admin in English", () => {
  it("switches the whole editor with the ES | EN toggle, and remembers it", async () => {
    signedIn();
    api();
    render(<AdminPage />);
    expect(await screen.findByText(/^2 artículos · /)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByText(/^2 items · \d+ sections · Saved$/)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("blufin.lang")).toBe("en");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Menu", "Home page", "QR codes"]);
    expect(screen.getByRole("heading", { name: "Poke elements" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Draft beer/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Protein/ })).toBeInTheDocument();

    // The ⋮ menu, the edit sheet and its field labels.
    await userEvent.click(screen.getByRole("button", { name: "Options for American Stout" }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
      "Edit",
      "Duplicate",
      "Mark as sold out",
      "Mark as coming soon",
      "Mark as almost gone",
      "Mark as new",
      "Hide from the menu",
      "Delete",
    ]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Edit item" })).toBeInTheDocument();
    expect(within(sheet).getByLabelText(/^Tap/)).toHaveValue("01");
    expect(within(sheet).getByLabelText(/^English name/)).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));

    // The home page cards too.
    await userEvent.click(screen.getByRole("tab", { name: "Home page" }));
    expect(screen.getByRole("form", { name: "Hero" })).toBeInTheDocument();
    expect(screen.getAllByText("Slogan in English").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Español" }));
    expect(screen.getByRole("tab", { name: "Página de inicio" })).toBeInTheDocument();
  });

  it("opens in English on an English device that never picked", async () => {
    localStorage.removeItem("blufin.lang");
    signedIn();
    api();
    render(<AdminPage />);
    expect(await screen.findByRole("tab", { name: "Menu" })).toBeInTheDocument();
  });
});

describe("/admin Códigos QR", () => {
  it("shows a QR for /menu and /menu-tv on the live site, each downloadable as a PNG", async () => {
    signedIn();
    api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("tab", { name: "Códigos QR" }));
    for (const url of ["https://blufinpoke.com/menu/", "https://blufinpoke.com/menu-tv/"]) {
      expect(screen.getByRole("img", { name: `Código QR de ${url}` })).toHaveAttribute("src", expect.stringMatching(/^data:image\/svg\+xml/));
      expect(screen.getByRole("link", { name: url })).toHaveAttribute("href", url);
    }

    // jsdom has no canvas: fake one and catch the download link's click.
    const fillRect = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect, fillStyle: "" } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AAAA");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {});
    const tv = screen.getByRole("region", { name: "Menú para TV" });
    await userEvent.click(within(tv).getByRole("button", { name: "Descargar PNG" }));
    expect(click).toHaveBeenCalledTimes(1);
    const a = click.mock.contexts[0] as HTMLAnchorElement;
    expect(a.download).toBe("blufin-menu-tv-qr.png");
    expect(a.href).toBe("data:image/png;base64,AAAA");
    expect(fillRect.mock.calls.length).toBeGreaterThan(100); // white background, then the dark modules
  });
});

describe("/admin Usuarios y Actividad", () => {
  const USERS = [
    { id: 1, email: "ruth@blufin.mx", name: "Ruth", role: "admin", active: true, menu: true, landing: true },
    { id: 2, email: "mesera@blufin.mx", name: "", role: "editor", active: true, menu: true, landing: true },
  ];
  const ADMIN = { email: "ruth@blufin.mx", admin: true, menu: true, landing: true };
  /** The editor API as `me`, with the users list, the activity log, and echoing writes. */
  const usersApi = (me: object = ADMIN) =>
    api((url, init) => {
      if (url === `${API_URL}/api/editor/`) return json({ ...ROWS, me });
      if (url === `${API_URL}/api/editor/activity/`) return json([{ at: "2026-10-16T18:00:00Z", email: "mesera@blufin.mx", text: "Cambió tamaño de bowl “Small”: precio (MXN): 165 → 170" }]);
      if (url === `${API_URL}/api/editor/users/`)
        return init?.method === "POST" ? json({ id: 3, active: true, ...JSON.parse(String(init.body)) }, 201) : json(USERS);
      const m = url.match(/editor\/users\/(\d+)\/$/);
      if (m && init?.method === "DELETE") return new Response(null, { status: 204 });
      if (m) return json({ ...USERS.find((u) => u.id === Number(m[1])), ...JSON.parse(String(init!.body)) });
    });
  const tabs = () => screen.getAllByRole("tab").map((t) => t.textContent);

  it("shows each account only the tabs it may use", async () => {
    signedIn();
    usersApi({ email: "mesera@blufin.mx", admin: false, menu: false, landing: true });
    render(<AdminPage />);
    await waitFor(() => expect(tabs()).toEqual(["Página de inicio", "Códigos QR"]));
    // Starts on the one tab it has, not on the menu.
    expect(screen.getByRole("form", { name: "Portada" })).toBeInTheDocument();
    expect(screen.queryByText("American Stout")).not.toBeInTheDocument();
  });

  it("shows admins Usuarios and Actividad, with who changed what", async () => {
    signedIn();
    usersApi();
    render(<AdminPage />);
    await waitFor(() => expect(tabs()).toEqual(["Menú", "Página de inicio", "Códigos QR", "Usuarios", "Actividad"]));
    await userEvent.click(screen.getByRole("tab", { name: "Actividad" }));
    expect(await screen.findByText("Cambió tamaño de bowl “Small”: precio (MXN): 165 → 170")).toBeInTheDocument();
    expect(screen.getByText(/^mesera@blufin\.mx · /)).toBeInTheDocument();
  });

  it("adds an editor for the menu only, and narrows another's permissions after asking, with Deshacer", async () => {
    signedIn();
    const fetch = usersApi();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("tab", { name: "Usuarios" }));
    expect(await screen.findByText("Admin · Ruth · Tú")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Añadir" }));
    const form = screen.getByRole("form", { name: "Nuevo usuario" });
    await userEvent.type(within(form).getByLabelText("Correo"), "cocina@blufin.mx");
    await userEvent.type(within(form).getByLabelText(/^Contraseña temporal/), "una-clave-larga-123");
    await userEvent.click(within(form).getByLabelText(/^La página de inicio/));
    await userEvent.click(within(form).getByRole("button", { name: "Añadir usuario" }));
    expect(await screen.findByText("Editor · menú")).toBeInTheDocument();
    expect(JSON.parse(String(fetch.mock.calls.at(-1)![1]!.body))).toEqual({
      email: "cocina@blufin.mx",
      name: "",
      password: "una-clave-larga-123",
      role: "editor",
      menu: true,
      landing: false,
    });

    await userEvent.click(screen.getByRole("button", { name: "Opciones de mesera@blufin.mx" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Editar permisos" }));
    const edit = screen.getByRole("form", { name: "Editar a mesera@blufin.mx" });
    await userEvent.click(within(edit).getByLabelText(/^El menú/));
    await userEvent.click(within(edit).getByRole("button", { name: "Guardar" }));
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining("Editor · página de inicio"));
    expect(await screen.findByText("Editor · página de inicio")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(screen.getAllByText("Editor · menú y página de inicio")).toHaveLength(1));
    expect(JSON.parse(String(fetch.mock.calls.at(-1)![1]!.body))).toMatchObject({ role: "editor", menu: true, landing: true });
    confirm.mockRestore();
  });

  it("lets admins only edit their own name and password", async () => {
    signedIn();
    usersApi();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("tab", { name: "Usuarios" }));
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de ruth@blufin.mx" }));
    expect(screen.getAllByRole("menuitem").map((b) => b.textContent)).toEqual(["Editar", "Cambiar contraseña"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    expect(screen.getByRole("combobox", { name: /^Rol/ })).toBeDisabled();
  });
});
