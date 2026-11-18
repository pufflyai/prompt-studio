import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

test("a keep-open tab action runs immediately and dismissal does not replay it", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/region/region-tab-actions.canvas.tsx#EditableTitleAndBoundResource",
  );
  await preview.getByRole("button", { name: "Note actions" }).click();
  const action = preview.getByRole("menuitem", { name: "Next revision" });
  await action.click();
  await expect(preview.getByText("No action run → next", { exact: true })).toBeVisible();
  await expect(action).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(action).toHaveCount(0);
  await expect(preview.getByText("No action run → next", { exact: true })).toBeVisible();
});
