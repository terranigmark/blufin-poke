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

  it("hides an item with its switch", async () => {
    signedIn();
    const fetch = api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: /^Cerveza de barril/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "American Stout disponible" }));

    await screen.findByText("Cambios guardados");
    const [url, init] = fetch.mock.calls.at(-1)!;
    expect(url).toBe(`${API_URL}/api/editor/beers/2/`);
    expect(init).toMatchObject({ method: "PATCH", body: JSON.stringify({ id: 2, available: false }) });
    expect(screen.getByText("Oculto en el menú")).toBeInTheDocument();
  });

  it("edits an item's price in the sheet", async () => {
    signedIn();
    const fetch = api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: /^Tamaños de bowl/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Small/ }));

    const sheet = screen.getByRole("dialog");
    const price = within(sheet).getByLabelText("Precio (MXN)");
    await userEvent.clear(price);
    await userEvent.type(price, "175");
    await userEvent.click(within(sheet).getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [, init] = fetch.mock.calls.at(-1)!;
    expect(JSON.parse(String(init!.body))).toMatchObject({ id: 1, name: "Small", name_en: "", price: 175, available: true });
    expect(screen.getByText("$175")).toBeInTheDocument();
  });

  it("edits a beer's English name and description, which are optional", async () => {
    signedIn();
    const fetch = api();
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: /^Cerveza de barril/ }));
    await userEvent.click(screen.getByRole("button", { name: /^American Stout/ }));

    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByLabelText(/^Nombre en inglés/)).not.toBeRequired();
    await userEvent.type(within(sheet).getByLabelText(/^Descripción en inglés/), "Roasted coffee.");
    await userEvent.click(within(sheet).getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [, init] = fetch.mock.calls.at(-1)!;
    expect(JSON.parse(String(init!.body))).toMatchObject({ id: 2, name_en: "", description_en: "Roasted coffee." });
  });

  it("puts the switch back when saving fails", async () => {
    signedIn();
    api((url, init) => (init?.method === "PATCH" ? json({}, 500) : undefined));
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole("button", { name: /^Cerveza de barril/ }));
    const toggle = screen.getByRole("checkbox", { name: "American Stout disponible" });
    await userEvent.click(toggle);
    expect(await screen.findByText("El servidor no respondió. Intenta de nuevo en un momento.")).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });
});
