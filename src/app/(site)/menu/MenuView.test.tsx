import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MenuView } from "./MenuView";

describe("Menú page", () => {
  it("shows the bundled menu when the API is down, and filters by tab", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<MenuView />);
    expect(screen.getByText("Pacífico")).toBeInTheDocument();
    expect(screen.getByText("Kombucha")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cerveza nacional" }));
    expect(screen.queryByText("Kombucha")).not.toBeInTheDocument();
    expect(screen.getByText("Pacífico")).toBeInTheDocument();
    expect(location.search).toBe("?tab=nac");
  });
});
