import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: a clipped breadcrumb can hide the identifying part of the current document's name.
test("a clipped breadcrumb reveals the full document name on hover", async ({ page }) => {
  await page.clock.install();
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/breadcrumb/breadcrumb-document.canvas.tsx#ParentResourceAndDocument",
  );
  const name = "Quarterly planning brief";
  const label = preview.getByRole("navigation").getByText(name, { exact: true });
  const tooltip = preview.getByRole("tooltip");

  await preview.getByRole("button", { name: "Narrow breadcrumb" }).click();
  expect(await label.evaluate((element) => element.clientWidth > 0 && element.scrollWidth > element.clientWidth)).toBe(
    true,
  );
  await label.hover();
  await expect(tooltip).toHaveText(name);
  await expect(tooltip).toBeVisible();

  await preview.getByRole("button", { name: "Restore breadcrumb width" }).click();
  expect(await label.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);
  await label.hover();
  await page.clock.runFor(500);
  await expect(tooltip).toHaveCount(0);

  await preview.getByRole("button", { name: "Narrow to parent", exact: true }).click();
  const parentName = "PS-1 Annual planning";
  const parentLabel = preview.getByRole("navigation").getByText(parentName, { exact: true });
  expect(
    await parentLabel.evaluate(
      (element) =>
        element.scrollWidth === element.clientWidth &&
        element.getBoundingClientRect().right > element.closest("nav")!.getBoundingClientRect().right,
    ),
  ).toBe(true);
  await parentLabel.hover({ position: { x: 4, y: 6 } });
  await expect(tooltip).toHaveText(parentName);
  await expect(tooltip).toBeVisible();

  await preview.getByRole("button", { name: "Narrow to parent icon", exact: true }).click();
  expect(
    await parentLabel.evaluate(
      (element) => element.getBoundingClientRect().left >= element.closest("nav")!.getBoundingClientRect().right,
    ),
  ).toBe(true);
  await parentLabel
    .locator("..")
    .locator("svg")
    .hover({ position: { x: 1, y: 6 } });
  await expect(tooltip).toHaveText(parentName);
  await expect(tooltip).toBeVisible();

  await preview.getByRole("button", { name: "Restore breadcrumb width" }).click();
  await parentLabel.locator("..").locator("svg").hover();
  await page.clock.runFor(500);
  await expect(tooltip).toHaveCount(0);
});
