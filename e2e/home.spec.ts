import { expect, test } from "@playwright/test";

test("the hero lead wraps to the width of the title above it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const title = await page.locator("h1 span").first().boundingBox();
  const lead = await page.locator("h1 + p").boundingBox();
  expect(Math.round(lead!.x)).toBe(Math.round(title!.x));
  expect(Math.round(lead!.width)).toBe(Math.round(title!.width));
});
