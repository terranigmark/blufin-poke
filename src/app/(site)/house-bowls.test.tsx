import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { BowlRow, MenuRows } from "@/lib/api";
import { LanguageProvider } from "@/lib/i18n";
import Home from "./page";

const bowl = (id: number, name: string, extra: Partial<BowlRow> = {}): BowlRow => ({
  id,
  name,
  name_en: `${name} EN`,
  price: 200 + id,
  description: `Descripción ${id}`,
  description_en: `Description ${id}`,
  image_url: "",
  available: true,
  order: id,
  ...extra,
});

// Separate file: useMenu caches the live menu for the whole page load.
it("shows the first three orderable house bowls on the home page, in English too", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  const rows = {
    sizes: [],
    ingredients: [],
    extras: [],
    beers: [],
    drinks: [],
    bowls: [bowl(1, "Clásico"), bowl(2, "Agotado", { status: "agotado" }), bowl(3, "Picante"), bowl(4, "Verde"), bowl(5, "Quinto")],
  } as MenuRows;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(rows))));
  localStorage.setItem("blufin.lang", "en");
  render(
    <LanguageProvider>
      <Home />
    </LanguageProvider>,
  );
  const section = (await screen.findByRole("heading", { name: "House bowls" })).closest("section")!;
  const names = within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
  expect(names).toEqual(["Clásico EN", "Picante EN", "Verde EN"]);
  expect(within(section).getByText("Description 1")).toBeInTheDocument();
  expect(within(section).getByText("$201")).toBeInTheDocument();
  expect(within(section).getByRole("link", { name: /See the menu/ })).toHaveAttribute("href", "/menu?tab=poke");
});
