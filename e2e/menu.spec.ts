import { expect, test } from "@playwright/test";

test("on a wide screen the menu banner stays short, so the prices show above the fold", async ({ page }) => {
  await page.setViewportSize({ width: 1860, height: 970 });
  await page.goto("/menu/");
  const hero = (await page.locator("section").first().boundingBox())!;
  expect(hero.height).toBeLessThanOrEqual(260);
});
