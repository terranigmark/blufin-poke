import { expect, test } from "@playwright/test";

test.describe("on an English device", () => {
  test.use({ locale: "en-US" });

  test("opens in English, the toggle switches in place, and the choice sticks", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Build your poke" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.getByRole("button", { name: "Español" }).click();
    await expect(page.getByRole("heading", { name: "Arma tu poke" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page).toHaveURL(/\/$/); // same URL, no reload

    await page.reload();
    await expect(page.getByRole("heading", { name: "Arma tu poke" })).toBeVisible();
  });

  test("the manager's English name shows on the English menu", async ({ page }) => {
    await page.goto("/login/");
    await page.fill("input[name=email]", "gerente@blufin.mx");
    await page.fill("input[name=password]", "una-clave-larga-123");
    await page.click("button:has-text('Entrar')");
    await expect(page).toHaveURL(/\/admin\/$/);
    await page.click("button:has-text('Kombucha')");
    await page.fill("dialog input[name=name_en]", "House kombucha");
    // /admin follows the same English device setting.
    await page.click("dialog button:has-text('Save changes')");
    await expect(page.locator("dialog")).toHaveCount(0); // closes once the server has saved it

    await page.goto("/menu/?tab=aguas");
    await expect(page.getByText("House kombucha")).toBeVisible();
    await expect(page.getByText("Sparkling water")).toBeVisible();
  });
});

test.describe("on a device in another language", () => {
  test.use({ locale: "fr-FR" });

  test("opens in Spanish", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Arma tu poke" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });
});
