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

test("an owner adds an editor, who signs in without the Usuarios tab, then disables them", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await signIn(page, "gerente@blufin.mx");
  await expect(page.getByRole("tab", { name: "Página de inicio" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Usuarios" })).toHaveCount(0);
  await signOut(page);

  await signIn(page, "duena@blufin.mx");
  await page.getByRole("tab", { name: "Usuarios" }).click();
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  const form = page.getByRole("form", { name: "Nuevo usuario" });
  await form.getByLabel("Correo").fill("cocina@blufin.mx");
  await form.getByLabel(/^Contraseña temporal/).fill("clave-temporal-789");
  await form.getByRole("button", { name: "Añadir usuario" }).click();
  await expect(page.getByText("cocina@blufin.mx", { exact: true })).toBeVisible();
  await signOut(page);

  await signIn(page, "cocina@blufin.mx", "clave-temporal-789");
  await expect(page.getByRole("tab", { name: "Usuarios" })).toHaveCount(0);
  await signOut(page);

  await signIn(page, "duena@blufin.mx");
  await page.getByRole("tab", { name: "Usuarios" }).click();
  await page.getByRole("button", { name: "Opciones de cocina@blufin.mx" }).click();
  await page.getByRole("menuitem", { name: "Desactivar" }).click();
  await expect(page.getByText("Editor · Desactivado")).toBeVisible();
  await signOut(page);

  await page.fill("input[name=email]", "cocina@blufin.mx");
  await page.fill("input[name=password]", "clave-temporal-789");
  await page.click("button:has-text('Entrar')");
  await expect(page.getByRole("alert")).toBeVisible();
});
