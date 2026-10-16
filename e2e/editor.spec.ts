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
}

test("signing in goes to /admin, and /login and /admin redirect by session", async ({ page }) => {
  await page.goto("/admin/");
  await expect(page).toHaveURL(/\/login\/$/);
  await signIn(page);
  await page.goto("/login/");
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.click("button[aria-label='Más']");
  await page.click("[role=menuitem]:has-text('Salir')");
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

test("Deshacer reverts a save, a hide, a delete and a drag", async ({ page }) => {
  await signIn(page);
  const undo = async (expected: string) => {
    await page.click("button:has-text('Deshacer')");
    await expect.poll(() => sizes(page)).toBe(expected);
  };
  const start = "Small:165,Regular:235";

  await page.click("button:has-text('Regular')");
  await page.fill("dialog input[name=price]", "250");
  await page.click("dialog button:has-text('Guardar cambios')");
  await expect.poll(() => sizes(page)).toBe("Small:165,Regular:250");
  await undo(start);

  await page.click("button[aria-label='Opciones de Small']");
  await page.click("[role=menuitem]:has-text('Ocultar del menú')");
  await expect.poll(() => sizes(page)).toBe("Regular:235");
  await undo(start);

  // Deletes straight away, as in Cervesoft: no "are you sure?", Deshacer is the way back.
  await page.click("button[aria-label='Opciones de Regular']");
  await page.click("[role=menuitem]:has-text('Eliminar')");
  await expect.poll(() => sizes(page)).toBe("Small:165");
  await undo(start);

  // Drag with the keyboard (the same handle a finger or mouse drags): pick up, move down, drop.
  await page.focus("button[aria-label='Arrastra para reordenar Small']");
  for (const key of ["Space", "ArrowDown", "Space"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250); // dnd-kit moves on the next animation frames
  }
  await expect.poll(() => sizes(page)).toBe("Regular:235,Small:165");
  await undo(start);
});

test("dragging a row with the mouse reorders it", async ({ page }) => {
  await signIn(page);
  const handle = page.locator("button[aria-label='Arrastra para reordenar Small']");
  const target = page.locator("button[aria-label='Arrastra para reordenar Regular']");
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + 20, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 10, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => sizes(page)).toBe("Regular:235,Small:165");
  await page.click("button:has-text('Deshacer')");
  await expect.poll(() => sizes(page)).toBe("Small:165,Regular:235");
});

test("the ⋮ menu marks a status the public menu shows, duplicates and deletes", async ({ page }) => {
  await signIn(page);
  const statusOf = async (name: string) =>
    (await (await page.request.get(API)).json()).sizes.find((z: { name: string }) => z.name === name)?.status;
  const action = async (row: string, label: string) => {
    await page.click(`button[aria-label='Opciones de ${row}']`);
    await page.click(`[role=menuitem]:has-text('${label}')`);
  };

  await action("Small", "Marcar como agotado");
  await expect.poll(() => statusOf("Small")).toBe("agotado");
  const menu = await page.context().newPage();
  await menu.goto("/menu/?tab=poke");
  await expect(menu.locator("div[data-status=agotado]")).toContainText(/Agotado|Sold out/); // the test phone reads the site in English
  await menu.close();
  await page.click("button:has-text('Deshacer')");
  await expect.poll(() => statusOf("Small")).toBe("");

  await action("Small", "Duplicar");
  await expect.poll(() => sizes(page)).toBe("Small:165,Regular:235,Small (copia):165");
  // The menu of a section's last row must not be cut off by the section (real bug: Eliminar was unreachable).
  await page.click("button[aria-label='Opciones de Small (copia)']");
  const hit = await page.locator("[role=menuitem]:has-text('Eliminar')").evaluate((el) => {
    // Scroll the page, not the section: scrollIntoView would scroll a clipping section and hide the bug.
    window.scrollBy(0, el.getBoundingClientRect().bottom - innerHeight + 20);
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("[role=menuitem]") === el;
  });
  expect(hit).toBe(true);
  await page.keyboard.press("Escape");
  await action("Small (copia)", "Eliminar");
  await expect.poll(() => sizes(page)).toBe("Small:165,Regular:235");
});
