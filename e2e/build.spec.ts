import { expect, test } from "@playwright/test";

test("the photo caption keeps clear of the step list on a phone", async ({ page }) => {
  await page.goto("/arma-tu-poke/");
  await page.evaluate(() => document.fonts.ready);
  const caption = (await page.getByText("happier people").filter({ visible: true }).boundingBox())!;
  const firstStep = (await page.locator("ol li").filter({ visible: true }).first().boundingBox())!;
  expect(firstStep.y - (caption.y + caption.height)).toBeGreaterThanOrEqual(20);
});
