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
  // Short enough that the copy's menu reaches the Deshacer bar, which must not cover it.
  await page.setViewportSize({ width: 412, height: 790 });
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
  // The menu of a section's last row must not be cut off by the section or covered by the Deshacer bar
  // (real bugs: Eliminar was unreachable).
  await page.click("button[aria-label='Opciones de Small (copia)']");
  const hit = await page.locator("[role=menuitem]:has-text('Eliminar')").evaluate((el) => {
    // Scroll the page, not the section: scrollIntoView would scroll a clipping section and hide the bug.
    // Instant: the site's smooth scrolling would still be moving when the point is checked.
    window.scrollBy({ top: el.getBoundingClientRect().bottom - innerHeight + 20, behavior: "instant" });
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("[role=menuitem]") === el;
  });
  expect(hit).toBe(true);
  await page.keyboard.press("Escape");
  await action("Small (copia)", "Eliminar");
  await expect.poll(() => sizes(page)).toBe("Small:165,Regular:235");
});

test("three house bowls added in the editor show on the home page and the menu", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Bowls de la casa|House bowls/ })).toHaveCount(0);

  await page.goto("/admin/");
  for (const [name, price] of [["Clásico", "215"], ["Picante", "225"], ["Verde", "205"]]) {
    await page.click("button[aria-label='Añadir a Bowls de la casa']");
    await page.fill("dialog input[name=name]", name);
    await page.fill("dialog input[name=price]", price);
    await page.fill("dialog textarea[name=description]", `${name} con atún y aguacate`);
    await page.click("dialog button:has-text('Añadir artículo')");
    await expect(page.locator("dialog")).toHaveCount(0);
  }

  await page.goto("/");
  const section = page.locator("section", { has: page.getByRole("heading", { name: /Bowls de la casa|House bowls/ }) });
  await expect(section.getByRole("heading", { level: 3 })).toHaveText(["Clásico", "Picante", "Verde"]);
  await page.goto("/menu/?tab=poke");
  await expect(page.getByText("Picante con atún y aguacate")).toBeVisible();
});

test("a beer's SRM colour from the editor shows as its tap dot on the menu", async ({ page }) => {
  await signIn(page);
  await page.click("button:has-text('American Stout')");
  await page.getByRole("dialog").getByRole("radio", { name: "SRM 12" }).check({ force: true });
  await page.click("dialog button:has-text('Guardar cambios')");
  await expect(page.locator("dialog")).toHaveCount(0);

  await page.goto("/menu/?tab=beer");
  await expect(page.getByText("Tap 01").locator("+ span")).toHaveCSS("background-color", "rgb(207, 105, 0)");
});

test("a list added in Otros gets its own section on the menu", async ({ page }) => {
  await signIn(page);
  page.on("dialog", (d) => d.accept("Postres"));
  await page.click("button:has-text('Nueva lista en Otros')");
  await page.click("button[aria-label='Añadir a Postres']");
  await page.fill("dialog input[name=name]", "Brownie");
  await page.fill("dialog input[name=price]", "60");
  await page.click("dialog button:has-text('Añadir artículo')");
  await expect(page.locator("dialog")).toHaveCount(0);

  await page.goto("/menu/?tab=postres");
  await expect(page.getByRole("heading", { name: "Postres" })).toBeVisible();
  await expect(page.getByText("Brownie")).toBeVisible();
  const menu = await (await page.request.get(API)).json();
  expect(menu.categories.find((c: { key: string }) => c.key === "postres").group).toBe("others");
});

test("the home page's cards save to the live site, and Deshacer puts it back", async ({ page }) => {
  await signIn(page);
  const asked: string[] = [];
  page.on("dialog", (d) => (asked.push(d.message()), d.accept()));
  await page.click("[role=tab]:has-text('Página de inicio')");
  const hero = page.getByRole("form", { name: "Portada" });
  await hero.getByLabel("Frase", { exact: true }).fill("Olas, poke y cerveza");
  await hero.getByLabel("Frase en inglés").fill("Waves, poke and beer");
  await hero.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardaste la página de inicio")).toBeVisible();
  expect(asked).toEqual([expect.stringContaining("Publicar")]);

  // The test phone reads English.
  await page.goto("/");
  await expect(page.getByText("Waves, poke and beer")).toBeVisible();

  await page.goto("/admin/");
  await page.click("[role=tab]:has-text('Página de inicio')");
  const belt = page.getByRole("form", { name: "Franja animada" });
  await belt.getByRole("button", { name: "Quitar texto 1" }).click();
  await belt.getByRole("button", { name: "Guardar" }).click();
  await page.click("button:has-text('Deshacer')");
  await expect(belt.getByLabel("Texto 1", { exact: true })).toHaveValue("Poke");

  // Leave the hero as the other tests expect it.
  await hero.getByLabel("Frase", { exact: true }).fill("Buena comida, cerveza fría, gente de mar");
  await hero.getByLabel("Frase en inglés").fill("Good food, cold beer, ocean people");
  await hero.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardaste la página de inicio")).toBeVisible();
});
