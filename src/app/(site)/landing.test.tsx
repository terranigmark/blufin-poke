import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Header } from "@/components/Header";
import { LANDING } from "@/data/landing";
import { API_URL, type MenuRows } from "@/lib/api";
import { LanguageProvider } from "@/lib/i18n";
import Home from "./page";

// Separate file: the live menu and home page are cached for the whole page load.
it("shows the home page as edited in /admin, in English with Spanish where English is empty", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  const rows = {
    sizes: [],
    ingredients: [],
    extras: [],
    beers: [],
    drinks: [],
    bowls: [],
    // No "belt": a section the backend doesn't have keeps the bundled one.
    landing: {
      header: { marlin_logo: "/api/media/3/", blufin_logo: "" },
      hero: {
        ...LANDING.hero,
        image: "/api/media/4/",
        video: "",
        slogan: "Olas y poke",
        slogan_en: "Waves and poke",
        title: "Poke\nBaja\nCerveza",
        title_en: "",
        hours: "Diario",
        hours_en: "Every day",
      },
    },
  } as MenuRows;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(rows))));
  localStorage.setItem("blufin.lang", "en");
  const { container } = render(
    <LanguageProvider>
      <Header />
      <Home />
    </LanguageProvider>,
  );

  expect(await screen.findByText("Waves and poke")).toBeInTheDocument();
  expect(within(screen.getByRole("heading", { level: 1 })).getAllByText(/./).map((x) => x.textContent)).toEqual(["Poke", "Baja", "Cerveza"]);
  expect(screen.getByText("Every day")).toBeInTheDocument();
  // The hero's picture comes from the API, and no video plays when it was removed.
  expect(screen.getByAltText("Waves at sunset on the beach")).toHaveAttribute("src", `${API_URL}/api/media/4/`);
  expect(container.querySelector("video")).toBeNull();
  // An uploaded logo replaces the lettering; the other keeps it.
  const logo = screen.getByRole("link", { name: "Blufin Poke Co · Home" });
  expect(logo.querySelector("img")).toHaveAttribute("src", `${API_URL}/api/media/3/`);
  expect(within(logo).queryByText("MARLIN")).toBeNull();
  expect(within(logo).getByText("Blufin")).toBeInTheDocument();
  expect(screen.getAllByTestId("text-band")[0]).toHaveTextContent("Catch of the day");
});
