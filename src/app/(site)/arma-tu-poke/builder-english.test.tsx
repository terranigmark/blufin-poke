import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { LanguageProvider } from "@/lib/i18n";
import { encodeOrder } from "@/lib/order";
import { Builder } from "./Builder";

vi.mock("@/lib/order", async (orig) => {
  const m = await orig<typeof import("@/lib/order")>();
  return { ...m, encodeOrder: vi.fn(m.encodeOrder) };
});

const click = (name: string | RegExp) => userEvent.click(screen.getAllByRole("button", { name })[0]);
const pick = (name: string) => userEvent.click(screen.getAllByText(name, { selector: "span" })[0].closest("button")!);
const next = () => click(/^(Next|See my bowl) →$/);

it("builds a bowl in English; the waiter's QR carries the order in Spanish", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  localStorage.setItem("blufin.lang", "en");
  render(
    <LanguageProvider>
      <Builder />
    </LanguageProvider>,
  );
  const steps = within(screen.getAllByRole("list")[0]).getAllByRole("listitem").map((li) => li.textContent);
  expect(steps).toEqual(["1Pick your base and protein", "2Add mix-ins, sauces, toppings and crunchies", "3Show your code to your server"]);
  await click(/Start/);
  expect(screen.getByRole("heading", { name: "Choose your base" })).toBeInTheDocument();
  // Names from the printed English menu.
  for (const name of ["Green mix", "Nachos", "Mix"]) expect(screen.getByText(name, { selector: "span" })).toBeInTheDocument();
  await pick("Sushi rice");
  await next();
  await pick("Tuna");
  await pick("Shrimp");
  expect(screen.getByText(/The second protein costs extra/)).toBeInTheDocument();
  await click(/Regular/);
  await next();
  await next();
  await pick("Teriyaki");
  await next();
  await next();
  await next();

  expect(screen.getByRole("heading", { name: "Here’s your bowl" })).toBeInTheDocument();
  await click("+ Add a drink");
  await click("Water & soft drinks");
  const coco = screen.getByText("Coconut water").closest("div")!;
  expect(within(coco).getByText("Can · 330 ml")).toBeInTheDocument();
  await userEvent.click(within(coco).getByRole("button", { name: "Add" }));
  expect(screen.getAllByText("1 drink")[0]).toBeInTheDocument();
  await click("Get code →");

  expect(screen.getByText("Show this code to your server")).toBeInTheDocument();
  const ticket = screen.getByText("Your order").closest("div")!.parentElement!;
  expect(within(ticket).getByText("Sushi rice")).toBeInTheDocument();
  expect(within(ticket).getByText("Tuna, Shrimp")).toBeInTheDocument();
  expect(within(ticket).getByText("1× Coconut water")).toBeInTheDocument();

  const sent = vi.mocked(encodeOrder).mock.calls[0][0];
  expect(sent.r).toEqual([
    ["Base", "Arroz sushi"],
    ["Proteína", "Atún, Camarón"],
    ["Tamaño", "Regular"],
    ["Salsa", "Teriyaki"],
    ["Bebidas", "1× Agua de coco"],
  ]);

});
