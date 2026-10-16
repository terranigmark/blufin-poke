import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUSINESS } from "@/data/menu";
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

  it("leaves Bowls de la casa out until the editor has three", () => {
    render(<Home />);
    expect(screen.queryByText("Bowls de la casa")).not.toBeInTheDocument();
  });

  it("has a text band after the hero and another before the footer", () => {
    render(<Home />);
    expect(screen.getAllByTestId("text-band")).toHaveLength(2);
  });

  it("ends the visit section with one button and the email as a plain link", () => {
    render(<Home />);
    const visit = screen.getByRole("heading", { name: "Ven a vernos" }).parentElement!;
    const email = within(visit).getByRole("link", { name: BUSINESS.email });
    expect(email).toHaveAttribute("href", `mailto:${BUSINESS.email}`);
    expect(email.className).toMatch(/visitEmail/);
  });
});
