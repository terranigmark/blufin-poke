import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { encodeOrder } from "@/lib/order";
import { Ticket } from "./Ticket";

afterEach(() => {
  location.hash = "";
});

describe("Waiter ticket", () => {
  it("shows the order packed in the scanned link", () => {
    location.hash = encodeOrder({ c: "#BF-1234", t: "13:45", r: [["Base", "Ensalada"]] });
    render(<Ticket />);
    expect(screen.getByText("#BF-1234")).toBeInTheDocument();
    expect(screen.getByText("Ensalada")).toBeInTheDocument();
  });

  it("shows a sample order with no link, and a warning for a broken one", () => {
    const { unmount } = render(<Ticket />);
    expect(screen.getByText("#BF-4821")).toBeInTheDocument();
    unmount();
    location.hash = "roto";
    render(<Ticket />);
    expect(screen.getByText("No pudimos leer este pedido")).toBeInTheDocument();
  });
});
