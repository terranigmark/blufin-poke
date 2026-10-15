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
    drinks: [{ id: 1, category: "aguas", name: "Horchata de la casa", price: 45, size: "500 ml", pack: "Botella", available: true, order: 0 }],
  };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(rows)));
  vi.stubGlobal("fetch", fetch);
  render(<MenuView />);
  expect(screen.getByText("Kombucha")).toBeInTheDocument(); // bundled menu first
  expect(await screen.findByText("Horchata de la casa")).toBeInTheDocument();
  expect(screen.queryByText("Kombucha")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(`${API_URL}/api/menu/`);
});
