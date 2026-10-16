import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string, password = "una-clave-larga-123") {
  await page.goto("/login/");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.click("button:has-text('Entrar')");
  await expect(page).toHaveURL(/\/admin\/$/);
}

async function signOut(page: Page) {
  await page.click("button[aria-label='Más']");
  await page.click("[role=menuitem]:has-text('Salir')");
  await expect(page).toHaveURL(/\/login\/$/);
}

const tabs = (page: Page) => page.getByRole("tab");

test("an admin adds a home-page-only editor, sees what they changed, then disables them", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await signIn(page, "gerente@blufin.mx");
  await expect(tabs(page)).toHaveText(["Menú", "Página de inicio"]);
  await signOut(page);

  await signIn(page, "duena@blufin.mx");
  await expect(tabs(page)).toHaveText(["Menú", "Página de inicio", "Usuarios", "Actividad"]);
  await page.getByRole("tab", { name: "Usuarios" }).click();
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  const form = page.getByRole("form", { name: "Nuevo usuario" });
  await form.getByLabel("Correo").fill("cocina@blufin.mx");
  await form.getByLabel(/^Contraseña temporal/).fill("clave-temporal-789");
  await form.getByLabel(/^El menú/).uncheck();
  await form.getByRole("button", { name: "Añadir usuario" }).click();
  await expect(page.getByText("Editor · página de inicio", { exact: true })).toBeVisible();
  await signOut(page);

  // Only the home page: no menu, users or activity.
  await signIn(page, "cocina@blufin.mx", "clave-temporal-789");
  await expect(tabs(page)).toHaveText(["Página de inicio"]);
  const belt = page.getByRole("form", { name: "Franja animada" });
  await belt.getByRole("textbox").first().fill("Fresco");
  await belt.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardaste la página de inicio")).toBeVisible();
  await signOut(page);

  await signIn(page, "duena@blufin.mx");
  await page.getByRole("tab", { name: "Actividad" }).click();
  const log = page.getByRole("list", { name: "Actividad" });
  await expect(log.getByRole("listitem").first()).toContainText("Cambió la página de inicio: Franja animada");
  await expect(log.getByRole("listitem").first()).toContainText("cocina@blufin.mx");
  await expect(log).toContainText("Añadió a cocina@blufin.mx (Editor: página de inicio)");

  await page.getByRole("tab", { name: "Usuarios" }).click();
  await page.getByRole("button", { name: "Opciones de cocina@blufin.mx" }).click();
  await page.getByRole("menuitem", { name: "Desactivar" }).click();
  await expect(page.getByText("Editor · página de inicio · Desactivado")).toBeVisible();
  await signOut(page);

  await page.fill("input[name=email]", "cocina@blufin.mx");
  await page.fill("input[name=password]", "clave-temporal-789");
  await page.click("button:has-text('Entrar')");
  await expect(page.getByRole("alert")).toBeVisible();
});
