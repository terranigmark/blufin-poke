import { expect, test } from "@playwright/test";

test("the hero lead wraps to the width of the title above it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const title = await page.locator("h1 span").first().boundingBox();
  const lead = await page.locator("h1 + p").boundingBox();
  expect(Math.round(lead!.x)).toBe(Math.round(title!.x));
  expect(Math.round(lead!.width)).toBe(Math.round(title!.width));
});

test("the text band slides only while the page scrolls", async ({ page }) => {
  await page.goto("/");
  const band = page.getByTestId("text-band").first();
  const p = () => band.evaluate((el) => el.style.getPropertyValue("--p"));
  const before = await p();
  await page.evaluate(() => window.scrollBy(0, 300));
  await expect.poll(p).not.toBe(before);
});

test("photos below the fold settle from a slight zoom as they appear", async ({ page }) => {
  await page.goto("/");
  const photo = page.getByAltText(/poke bowl/i);
  const scale = () => photo.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  // Reveal hides the photo after hydration, and the zoom-in to 1.06 is itself a 0.9s transition.
  await expect.poll(scale).toBeCloseTo(1.06);
  await photo.scrollIntoViewIfNeeded();
  await expect.poll(scale).toBe(1);
});

test.describe("with reduced motion", () => {
  test("the band and photos stay still", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => window.scrollBy(0, 600));
    expect(await page.getByTestId("text-band").first().evaluate((el) => el.style.getPropertyValue("--p"))).toBe("");
    const photo = page.getByAltText(/poke bowl/i);
    expect(await photo.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  });
});

test("on a phone, the odd last craving tile spans the row instead of leaving a hole", async ({ page }) => {
  await page.goto("/");
  const tiles = page.locator("a[href]").filter({ has: page.locator("img") }).filter({ hasText: /Extras|Bebidas|Drinks|Cerveza|Craft/ });
  await expect(tiles).toHaveCount(3);
  const [a, b, c] = await Promise.all([0, 1, 2].map(async (i) => (await tiles.nth(i).boundingBox())!));
  expect(Math.round(c.width)).toBe(Math.round(b.x + b.width - a.x));
});
