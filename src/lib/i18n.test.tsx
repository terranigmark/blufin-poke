import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/Header";
import { LanguageProvider, detectLang, pick } from "./i18n";

const device = (...languages: string[]) => vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);

afterEach(() => {
  document.documentElement.lang = "";
});

describe("language detection", () => {
  it.each([
    [["es-MX"], "es"],
    [["en-US"], "en"],
    [["en-GB", "es"], "en"],
    [["es-ES", "en"], "es"],
    [["fr-FR", "en"], "en"], // first Spanish or English entry wins
    [["fr-FR", "de"], "es"], // neither: Spanish
  ])("device %j reads the site in %s", (languages, lang) => {
    device(...languages);
    expect(detectLang()).toBe(lang);
  });

  it("a choice made with the toggle beats the device", () => {
    device("en-US");
    localStorage.setItem("blufin.lang", "es");
    expect(detectLang()).toBe("es");
  });

  it("English falls back to the Spanish text when there is none", () => {
    expect(pick("en")("Atún", "Tuna")).toBe("Tuna");
    expect(pick("en")("Tofu", "")).toBe("Tofu");
    expect(pick("es")("Atún", "Tuna")).toBe("Atún");
  });
});

describe("header toggle", () => {
  it("opens in the device language, switches without reloading, and remembers the choice", async () => {
    device("en-US");
    render(
      <LanguageProvider>
        <Header />
      </LanguageProvider>,
    );
    expect(await screen.findByRole("link", { name: "Menu" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Español" }));
    expect(screen.getByRole("link", { name: "Menú" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Arma tu poke/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es");
    expect(localStorage.getItem("blufin.lang")).toBe("es");
  });

  it("shows Spanish when the device is in another language", async () => {
    device("fr-FR");
    render(
      <LanguageProvider>
        <Header />
      </LanguageProvider>,
    );
    await act(async () => {});
    expect(screen.getByRole("link", { name: "Menú" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es");
  });
});
