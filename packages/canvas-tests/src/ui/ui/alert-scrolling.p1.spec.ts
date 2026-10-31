import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: an inline notice must not block reading the surrounding document.
test("scrolling over alerts continues through the article", async ({ page }) => {
  const preview = await openCanvasPreview(page, "ui-primitives-alertmessage--page-scrolling");
  const article = preview.getByRole("region", { name: "Article", exact: true });
  const notices = preview.locator(".chakra-alert__root");
  const short = notices.filter({ hasText: "Preview notice" });
  const long = notices.filter({ hasText: "Import details" }).locator("[data-part=viewport]");
  const scrollTop = () => article.evaluate((element) => element.scrollTop);

  await short.hover();
  await page.mouse.wheel(0, 80);
  await expect.poll(scrollTop).toBeGreaterThan(0);

  await article.evaluate((element) => {
    element.scrollTop = 0;
  });
  await long.hover();
  await page.mouse.wheel(0, 80);
  await expect.poll(() => long.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await scrollTop()).toBe(0);

  await long.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.mouse.wheel(0, 80);
  await expect.poll(scrollTop).toBeGreaterThan(0);
});
