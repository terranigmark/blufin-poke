import { describe, expect, it } from "vitest";
import { SAMPLE_ORDER, decodeOrder, encodeOrder } from "./order";

describe("order links", () => {
  it("round-trips an order, accents and all, through a URL-safe hash", () => {
    const order = { ...SAMPLE_ORDER, r: [...SAMPLE_ORDER.r, ["Nota", "Sin jalapeño, ¿más limón? 🍋"]] as [string, string][] };
    const hash = encodeOrder(order);
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeOrder("#" + hash)).toEqual(order);
  });

  it("rejects links that are not an order", () => {
    expect(decodeOrder("#not-base64!")).toBeNull();
    expect(decodeOrder("#" + encodeOrder({ hola: 1 } as never))).toBeNull();
  });
});
