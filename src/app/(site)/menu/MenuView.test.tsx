import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/lib/i18n";
import { MenuView } from "./MenuView";

describe("Menú page", () => {
  it("shows the bundled menu when the API is down, and filters by tab", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<MenuView />);
    expect(screen.getByText("Pacífico")).toBeInTheDocument();
    expect(screen.getByText("Kombucha")).toBeInTheDocument();
    // Each tap's dot is its beer's SRM colour: the stout is SRM 40.
    expect(screen.getByText("Tap 01").nextElementSibling).toHaveStyle({ background: "#36080A" });

    await userEvent.click(screen.getByRole("button", { name: "Cerveza nacional" }));
    expect(screen.queryByText("Kombucha")).not.toBeInTheDocument();
    expect(screen.getByText("Pacífico")).toBeInTheDocument();
    expect(location.search).toBe("?tab=nac");
  });

  it("reads in English, falling back to Spanish names that have no translation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    localStorage.setItem("blufin.lang", "en");
    history.replaceState(null, "", "/menu"); // the first test left ?tab=nac
    render(
      <LanguageProvider>
        <MenuView />
      </LanguageProvider>,
    );
    expect(await screen.findByText("Sparkling water")).toBeInTheDocument();
    expect(screen.getByText("Kombucha")).toBeInTheDocument();
    expect(screen.getByText("Roasted coffee, bitter cocoa and a silky body.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mexican beer" }));
    expect(screen.queryByText("Sparkling water")).not.toBeInTheDocument();
    expect(screen.getByText("Pacífico")).toBeInTheDocument();
  });
});
