import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: document notices must not move typed content or cover the last line and recovery controls.
test("document notices stay below the scrolling editor without moving its first line", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/renderers/file/document-notice-footer.canvas.tsx#StickyFooter",
  );
  const heading = preview.getByRole("heading", { name: "Project notes", exact: true });
  await expect(heading).toBeVisible();
  const initialTop = await heading.evaluate((element) => element.getBoundingClientRect().top);
  await preview.getByRole("button", { name: "Show save failure", exact: true }).click();
  const retry = preview.getByRole("button", { name: "Retry", exact: true });
  await expect(retry).toBeVisible();
  expect(await heading.evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(initialTop, 0);
  const pane = preview.getByTestId("document-pane");
  const notice = retry.locator("..");
  await expect(notice).toHaveCSS("position", "sticky");
  const bottomGap = await notice.evaluate(
    (element) =>
      element.closest('[data-testid="document-pane"]')!.getBoundingClientRect().bottom -
      element.getBoundingClientRect().bottom,
  );
  expect(Math.abs(bottomGap)).toBeLessThanOrEqual(1);
  await pane.getByText("Last paragraph.", { exact: true }).scrollIntoViewIfNeeded();
  await expect(retry).toBeVisible();
  const unobscured = await pane.getByText("Last paragraph.", { exact: true }).evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return element.contains(
      element.ownerDocument.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
    );
  });
  expect(unobscured).toBe(true);
  await retry.click();
  await expect(retry).toHaveCount(0);
  await heading.scrollIntoViewIfNeeded();
  expect(await heading.evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(initialTop, 0);
});

// Critical: a shared document that cannot open must keep its recovery control reachable at the pane's bottom.
test("shared document opening failures stay at the bottom even without editor content", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/renderers/file/document-notice-footer.canvas.tsx#StickyFooter",
  );
  await preview.getByRole("button", { name: "Open unavailable shared document", exact: true }).click();
  const retry = preview.getByRole("button", { name: "Retry", exact: true });
  await expect(retry).toBeVisible();
  const bottomGap = await retry
    .locator("..")
    .evaluate(
      (element) =>
        element.closest('[data-testid="document-pane"]')!.getBoundingClientRect().bottom -
        element.getBoundingClientRect().bottom,
    );
  expect(Math.abs(bottomGap)).toBeLessThanOrEqual(1);
  await retry.click();
  await expect(preview.getByText("This shared document could not be opened.", { exact: true })).toBeVisible();
});
