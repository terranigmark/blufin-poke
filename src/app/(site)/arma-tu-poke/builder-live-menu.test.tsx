import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { MENU } from "@/data/menu";
import type { MenuRows } from "@/lib/api";
import { Builder } from "./Builder";

// Separate file: useMenu caches the live menu for the whole page load.
const click = (name: string | RegExp) => userEvent.click(screen.getAllByRole("button", { name })[0]);
const pick = (name: string) => userEvent.click(screen.getAllByText(name, { selector: "span" })[0].closest("button")!);

const ROWS: MenuRows = {
  sizes: [{ id: 1, key: "small", name: "Small", name_en: "", price: 170, available: true, order: 0 }],
  ingredients: MENU.STEPS.flatMap((st, i) =>
    st.opts.slice(0, 2).map((o, j) => ({ id: 100 + i * 10 + j, step: st.key, key: o.id, name: o.name, name_en: "", image_url: "", available: true, order: j })),
  ),
  extras: [{ id: 4, key: "xprot", name: "Proteína", name_en: "", price: 35, in_builder: true, available: true, order: 0 }],
  beers: [],
  drinks: [],
  bowls: [],
};

it("charges the second protein at the menu's Proteína extra price", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(ROWS))));
  render(<Builder />);
  await click(/Empezar/);
  await pick("Arroz sushi");
  await click(/Siguiente/);
  await screen.findByText("$170"); // the live menu has arrived
  await pick("Pesca del día");
  await pick("Atún");
  expect(screen.getByText(/La segunda proteína tiene costo extra/)).toHaveTextContent("La segunda proteína tiene costo extra: +$35");
});
