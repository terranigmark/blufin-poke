import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/lib/i18n";
import Home from "./page";

describe("Home hero", () => {
  beforeEach(() => {
    // jsdom lacks these; the hero video and Reveal use them.
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  });

  it("shows the tagline in Spanish by default", () => {
    render(<Home />);
    expect(screen.getByText("Buena comida, cerveza fría, gente de mar")).toBeInTheDocument();
  });

  it("shows the tagline in English", async () => {
    localStorage.setItem("blufin.lang", "en");
    render(
      <LanguageProvider>
        <Home />
      </LanguageProvider>,
    );
    expect(await screen.findByText("Good food, cold beer, ocean people")).toBeInTheDocument();
  });
});
