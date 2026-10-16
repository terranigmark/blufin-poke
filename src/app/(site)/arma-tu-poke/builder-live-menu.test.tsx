import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { MENU } from "@/data/menu";
import type { CategoryRow, MenuRows } from "@/lib/api";
import { Builder } from "./Builder";

// Separate file: useMenu caches the live menu for the whole page load.
const click = (name: string | RegExp) => userEvent.click(screen.getAllByRole("button", { name })[0]);
const pick = (name: string) => userEvent.click(screen.getAllByText(name, { selector: "span" })[0].closest("button")!);

const ROWS: MenuRows = {
  sizes: [{ id: 1, key: "small", name: "Small", name_en: "", price: 170, available: true, order: 0 }],
  ingredients: MENU.STEPS.flatMap((st, i) =>
    st.opts.map((o, j) => ({ id: 100 + i * 10 + j, step: st.key, key: o.id, name: o.name, name_en: "", image_url: "", available: true, order: j })),
  ),
  extras: [{ id: 4, key: "xprot", name: "Proteína", name_en: "", price: 35, in_builder: true, available: true, order: 0 }],
  beers: [],
  drinks: [
    { id: 1, category: "cocteles", name: "Mezcalita", name_en: "", price: 120, size: "300 ml", pack: "", available: true, order: 0 },
    { id: 2, category: "postres", name: "Brownie", name_en: "", price: 60, size: "", pack: "", available: true, order: 0 },
  ],
  bowls: [],
  categories: [
    ["beers", "beers", "drinks", "Cerveza artesanal"],
    ["cocteles", "drinks", "drinks", "Cócteles"],
    ["postres", "drinks", "others", "Postres"],
  ].map(([key, kind, group, name], i) => ({ id: i + 1, key, kind, group, name, name_en: "", available: true, order: i, builtin: false }) as CategoryRow),
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

it("offers the drinks lists the menu shows, and not the lists in Otros", async () => {
  render(<Builder />);
  await click(/Empezar/);
  await pick("Arroz sushi");
  await click(/Siguiente/);
  await pick("Atún");
  await click(/Small/);
  await click(/Siguiente/);
  await click(/Siguiente/); // mix-ins are optional
  await pick("Shoyu");
  await click(/Siguiente/);
  await click(/Siguiente/);
  await click(/Ver mi bowl/);

  await click("+ Agregar bebida");
  // No beers on this menu, so the manager's Cócteles list is the only tab.
  expect(screen.getByRole("button", { name: "Cócteles", pressed: true })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Postres" })).not.toBeInTheDocument();
  expect(screen.queryByText("Brownie")).not.toBeInTheDocument();
  const mezcalita = screen.getByText("Mezcalita").closest("div")!;
  expect(within(mezcalita).getByText("300 ml")).toBeInTheDocument();
  await userEvent.click(within(mezcalita).getByRole("button", { name: "Agregar" }));
  await click("Generar código →");
  expect(screen.getByText("1× Mezcalita")).toBeInTheDocument();
});
