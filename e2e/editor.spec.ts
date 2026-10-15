import { expect, test, type Page } from "@playwright/test";

const API = "http://localhost:8000/api/menu/";

/** "Small:165,Regular:235": the bowl sizes the public menu shows, in order. */
async function sizes(page: Page) {
  const menu = await (await page.request.get(API)).json();
  return menu.sizes.map((z: { name: string; price: number }) => `${z.name}:${z.price}`).join(",");
}

async function signIn(page: Page) {
  await page.goto("/login/");
  await page.fill("input[name=email]", "gerente@blufin.mx");
  await page.fill("input[name=password]", "una-clave-larga-123");
  await page.click("button:has-text('Entrar')");
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.click("button:has-text('Tamaños de bowl')");
}

test("signing in goes to /admin, and /login and /admin redirect by session", async ({ page }) => {
  await page.goto("/admin/");
  await expect(page).toHaveURL(/\/login\/$/);
  await signIn(page);
  await page.goto("/login/");
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.click("button:has-text('Salir')");
  await expect(page).toHaveURL(/\/login\/$/);
});

test("Cancelar asks before discarding edits and saves nothing", async ({ page }) => {
  await signIn(page);
  const asked: string[] = [];
  page.on("dialog", (d) => (asked.push(d.message()), d.accept()));

  await page.click("button:has-text('Regular')");
  await page.fill("dialog input[name=price]", "999");
  await page.click("dialog button:has-text('Cancelar')");
  await expect(page.locator("dialog")).toHaveCount(0);
  expect(asked).toEqual([expect.stringContaining("Descartar")]);

  // Esc takes the same path.
  await page.click("button:has-text('Regular')");
  await page.fill("dialog input[name=price]", "888");
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).toHaveCount(0);
  expect(asked).toHaveLength(2);

  // Nothing edited: closes without asking.
  await page.click("button:has-text('Regular')");
  await page.click("dialog button:has-text('Cancelar')");
  await expect(page.locator("dialog")).toHaveCount(0);
  expect(asked).toHaveLength(2);

  expect(await sizes(page)).toBe("Small:165,Regular:235");
});

test("Deshacer reverts a save, a hide, a delete and a move", async ({ page }) => {
  await signIn(page);
  page.on("dialog", (d) => d.accept());
  const undo = async (expected: string) => {
    await page.click("button:has-text('Deshacer')");
    await expect.poll(() => sizes(page)).toBe(expected);
  };
  const start = "Small:165,Regular:235";

  await page.click("button:has-text('Regular')");
  await page.fill("dialog input[name=price]", "250");
  await page.click("dialog button:has-text('Guardar')");
  await expect.poll(() => sizes(page)).toBe("Small:165,Regular:250");
  await undo(start);

  await page.locator("input[aria-label='Small disponible']").click({ force: true });
  await expect.poll(() => sizes(page)).toBe("Regular:235");
  await undo(start);

  await page.click("button:has-text('Regular')");
  await page.click("dialog button:has-text('Borrar')");
  await expect.poll(() => sizes(page)).toBe("Small:165");
  await undo(start);

  await page.click("button[aria-label='Bajar Small']");
  await expect.poll(() => sizes(page)).toBe("Regular:235,Small:165");
  await undo(start);
});
