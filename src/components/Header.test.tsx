import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const path = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

describe("Header", () => {
  it("marks Menú as the current page only on the menu", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    path.current = "/menu/";
    const { unmount } = render(<Header />);
    expect(screen.getByRole("link", { name: "Menú" })).toHaveAttribute("aria-current", "page");
    unmount();

    path.current = "/";
    render(<Header />);
    expect(screen.getByRole("link", { name: "Menú" })).not.toHaveAttribute("aria-current");
  });
});
