import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Builder } from "./Builder";

const click = (name: string | RegExp) => userEvent.click(screen.getAllByRole("button", { name })[0]);
// Option cards repeat their name in the photo's alt text, so find them by their label.
const pick = (name: string) => userEvent.click(screen.getAllByText(name, { selector: "span" })[0].closest("button")!);
const next = () => click(/^(Siguiente|Ver mi bowl) →$/);

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
});

describe("Arma tu poke", () => {
  it("builds a bowl and shows the order ticket with its QR code", async () => {
    render(<Builder />);
    // The intro explains the visit in three steps.
    const steps = within(screen.getAllByRole("list")[0]).getAllByRole("listitem").map((li) => li.textContent);
    expect(steps).toEqual(["1Elige tu base y tu proteína", "2Ponle mix-ins, salsas, toppings y crunchies", "3Muestra tu código al mesero"]);
    await click(/Empezar/);

    // Base: one choice, required.
    await next();
    expect(screen.getByRole("heading", { name: "Elige tu base" })).toBeInTheDocument();
    await pick("Arroz sushi");
    await next();

    // Protein needs a size too; the second protein costs extra.
    await pick("Atún");
    await pick("Camarón");
    expect(screen.getByText(/La segunda proteína tiene costo extra/)).toHaveTextContent("La segunda proteína tiene costo extra: +$25");
    await next();
    expect(screen.getByRole("heading", { name: "Elige tu proteína" })).toBeInTheDocument();
    await click(/Regular/);
    await next();

    await next(); // mix-ins are optional
    await pick("Shoyu");
    await next();
    await pick("Aguacate");
    await next();
    await next(); // crunchies are optional

    expect(screen.getByRole("heading", { name: "Así queda tu bowl" })).toBeInTheDocument();
    await click(/Wakame/);
    await click("Generar mi código →");

    expect(screen.getByAltText("Código QR de tu pedido")).toHaveAttribute("src", expect.stringMatching(/^data:image\/svg\+xml/));
    const ticket = screen.getByText("Tu pedido").closest("div")!.parentElement!;
    expect(within(ticket).getByText("Arroz sushi")).toBeInTheDocument();
    expect(within(ticket).getByText("Atún, Camarón")).toBeInTheDocument();
    expect(within(ticket).getByText("Regular")).toBeInTheDocument();
    expect(within(ticket).getByText("Wakame")).toBeInTheDocument();
    expect(within(ticket).queryByText("Mix-ins")).not.toBeInTheDocument();
    expect(screen.getByText(/^#BF-\d{4}$/)).toBeInTheDocument();
  });

  it("adds drinks to the order", async () => {
    render(<Builder />);
    await click(/Empezar/);
    await pick("Ensalada");
    await next();
    await pick("Tofu");
    await click(/Small/);
    await next();
    await next();
    await pick("Teriyaki");
    await next();
    await next();
    await next();

    await click("+ Agregar bebida");
    const stout = screen.getByText("American Stout").closest("div")!;
    await userEvent.click(within(stout).getAllByRole("button", { name: "Agregar" })[1]); // 16 oz
    await userEvent.click(within(stout).getAllByRole("button", { name: "Agregar" })[1]);
    expect(screen.getAllByText("2 bebidas")[0]).toBeInTheDocument();
    await click("Generar código →");
    expect(screen.getByText("2× American Stout 16 oz")).toBeInTheDocument();
  });
});
