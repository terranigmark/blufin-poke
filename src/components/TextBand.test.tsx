import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/lib/i18n";
import { TextBand } from "./TextBand";

const motion = (reduced: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
// jsdom places everything at top 0; put the band halfway through its pass across the screen.
const at = (top: number) =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top, height: 200 } as DOMRect);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("TextBand", () => {
  it("is hidden from screen readers and speaks both languages", async () => {
    motion(false);
    const { unmount } = render(<TextBand />);
    const band = screen.getByTestId("text-band");
    expect(band).toHaveAttribute("aria-hidden", "true");
    expect(band).toHaveTextContent("Pesca del día");
    unmount();

    localStorage.setItem("blufin.lang", "en");
    render(
      <LanguageProvider>
        <TextBand />
      </LanguageProvider>,
    );
    await vi.waitFor(() => expect(screen.getByTestId("text-band")).toHaveTextContent("Catch of the day"));
  });

  it("follows the scroll position", async () => {
    motion(false);
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => (f(0), 1));
    const rect = at(window.innerHeight); // just below the screen
    render(<TextBand />);
    const band = screen.getByTestId("text-band");
    expect(band.style.getPropertyValue("--p")).toBe("0.000");

    rect.mockReturnValue({ top: -200, height: 200 } as DOMRect); // just scrolled off the top
    act(() => void window.dispatchEvent(new Event("scroll")));
    expect(band.style.getPropertyValue("--p")).toBe("1.000");
  });

  it("stays still under reduced motion", () => {
    motion(true);
    at(0);
    render(<TextBand />);
    act(() => void window.dispatchEvent(new Event("scroll")));
    expect(screen.getByTestId("text-band").style.getPropertyValue("--p")).toBe("");
  });
});
