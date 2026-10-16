import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { API_URL, type MenuRows } from "@/lib/api";
import { MenuView } from "./MenuView";

// Separate file: useMenu caches the live menu for the whole page load.
it("swaps in the live menu from the API", async () => {
  const rows: MenuRows = {
    sizes: [],
    ingredients: [],
    extras: [],
    beers: [],
    bowls: [{ id: 3, name: "Clásico", name_en: "", price: 215, description: "Atún, aguacate y ponzu", description_en: "", image_url: "", available: true, order: 0 }],
    drinks: [
      { id: 1, category: "aguas", name: "Horchata de la casa", name_en: "", price: 45, size: "500 ml", pack: "Botella", available: true, order: 0 },
      { id: 2, category: "aguas", name: "Jamaica", name_en: "", price: 45, size: "500 ml", pack: "Botella", available: true, status: "agotado", order: 1 },
      { id: 3, category: "postres", name: "Brownie", name_en: "", price: 60, size: "", pack: "", available: true, order: 0 },
    ],
    // A list the manager added in Otros gets its own tab; Cerveza nacional is hidden.
    categories: [
      { id: 10, key: "aguas", kind: "drinks", group: "drinks", name: "Aguas y refrescos", name_en: "", available: true, order: 9, builtin: true },
      { id: 11, key: "nacional", kind: "drinks", group: "drinks", name: "Cerveza nacional", name_en: "", available: false, order: 10, builtin: true },
      { id: 12, key: "postres", kind: "drinks", group: "others", name: "Postres", name_en: "Desserts", available: true, order: 11, builtin: false },
    ],
  };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(rows)));
  vi.stubGlobal("fetch", fetch);
  render(<MenuView />);
  expect(screen.getByText("Kombucha")).toBeInTheDocument(); // bundled menu first
  expect(await screen.findByText("Horchata de la casa")).toBeInTheDocument();
  expect(screen.queryByText("Kombucha")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(`${API_URL}/api/menu/`);
  // The editor's "Marcar como agotado" shows as a badge, with the name struck through.
  expect(screen.getByText("Agotado").closest("[data-status]")).toHaveAttribute("data-status", "agotado");
  expect(screen.getByText("Jamaica")).toBeInTheDocument();
  // House bowls from the editor sit under the poke sizes.
  expect(screen.getByText("Bowls de la casa")).toBeInTheDocument();
  expect(screen.getByText("Atún, aguacate y ponzu")).toBeInTheDocument();
  expect(screen.getByText("$215")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Postres" })).toBeInTheDocument();
  expect(screen.getByText("Brownie")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Postres" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cerveza nacional" })).not.toBeInTheDocument();
  expect(screen.queryByText("Pacífico")).not.toBeInTheDocument();
});
