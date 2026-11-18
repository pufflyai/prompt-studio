import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

test("dismissing a rich error does not hide a later failure with the same title", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/primitives/alert.canvas.tsx#Actions",
    "Retry failure",
  );
  const alert = preview.getByRole("alert");
  const retry = alert.getByRole("button", { name: "Retry setup" });
  await expect(alert.getByText("Git is unavailable.", { exact: true })).toBeVisible();
  await retry.click();
  await alert.getByRole("button", { name: "Dismiss" }).click();
  await expect(alert).toHaveCount(0);
  await preview.getByRole("button", { name: "Finish retry" }).click();
  await expect(alert.getByText("The project folder cannot be written.", { exact: true })).toBeVisible();
  await expect(retry).toBeEnabled();
});

// Critical: an inline notice must not block reading the surrounding document.
test("scrolling over alerts continues through the article", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/primitives/alert.canvas.tsx#Actions",
    "Page scrolling",
  );
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
