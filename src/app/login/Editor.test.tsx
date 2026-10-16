import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_URL, type MenuRows } from "@/lib/api";
import { AdminPage, LoginPage } from "./Editor";

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
  beers: [{ id: 2, tap: "01", name: "American Stout", name_en: "", style: "Stout", abv: "5.2%", price_12: 100, price_16: 120, color: "#2A1810", description: "", description_en: "", available: true, order: 0 }],
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

beforeEach(() => replace.mockClear());

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

  it("puts a hidden item back when saving fails", async () => {
    signedIn();
    api((url, init) => (init?.method === "PATCH" ? json({}, 500) : undefined));
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de American Stout" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Ocultar del menú" }));
    expect(await screen.findByText("El servidor no respondió. Intenta de nuevo en un momento.")).toBeInTheDocument();
    expect(screen.queryByText(/· Oculto$/)).not.toBeInTheDocument();
  });
});
