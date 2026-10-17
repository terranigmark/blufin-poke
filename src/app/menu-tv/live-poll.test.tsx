import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { POLL_MS, type MenuRows } from "@/lib/api";
import { MenuTV } from "./MenuTV";

// Separate file: the live menu is shared module state for the whole page load.
const rows = (beer: string): MenuRows => ({
  sizes: [],
  ingredients: [],
  extras: [],
  bowls: [],
  drinks: [],
  beers: [{ id: 1, tap: "01", name: beer, name_en: "", style: "Stout", abv: "6%", price_12: 80, price_16: 100, srm: 40, description: "", description_en: "", available: true, order: 0 }],
});

const visibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
};

afterEach(() => vi.useRealTimers());

it("picks up menu edits every 10 minutes, and not while the screen is hidden", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const fetch = vi
    .fn()
    .mockImplementationOnce(async () => new Response(JSON.stringify(rows("Primera"))))
    .mockImplementation(async () => new Response(JSON.stringify(rows("Segunda"))));
  vi.stubGlobal("fetch", fetch);

  render(<MenuTV />);
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Primera")).toBeInTheDocument();

  // Not every few seconds: a minute in, still one request.
  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(fetch).toHaveBeenCalledTimes(1);

  visibility("hidden");
  await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
  expect(fetch).toHaveBeenCalledTimes(1);

  // Shown again: refreshes at once.
  visibility("visible");
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Segunda")).toBeInTheDocument();

  await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
  expect(fetch).toHaveBeenCalledTimes(3);
});
