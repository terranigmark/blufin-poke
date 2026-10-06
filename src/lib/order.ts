// The order lives entirely inside the QR link (`/orden#<base64url JSON>`), so
// no server is needed: the waiter scans it and the ticket page decodes it.

export type OrderData = {
  /** Short code to call the order out, e.g. "#BF-4821". */
  c: string;
  /** Local time "HH:MM" when the code was generated. */
  t: string;
  /** [label, value] rows, e.g. ["Base", "Arroz sushi"]. */
  r: [string, string][];
};

export function encodeOrder(data: OrderData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeOrder(hash: string): OrderData | null {
  try {
    let s = hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const d = JSON.parse(new TextDecoder().decode(bytes));
    return d && typeof d.c === "string" && Array.isArray(d.r) ? d : null;
  } catch {
    return null;
  }
}

export const SAMPLE_ORDER: OrderData = {
  c: "#BF-4821",
  t: "14:32",
  r: [
    ["Base", "Arroz sushi"],
    ["Proteína", "Atún, Pesca del día"],
    ["Tamaño", "Regular"],
    ["Mix-ins", "Cilantro, Cebolla morada, Ajonjolí"],
    ["Salsa", "Citrus Ponzu, Spicy Mayo"],
    ["Toppings", "Aguacate, Edamames, Pepino"],
    ["Crunchies", "Cebolla crispy"],
    ["Extras", "Aguacate"],
    ["Bebidas", "2× Baby IPA 16 oz, 1× Agua de coco"],
  ],
};
