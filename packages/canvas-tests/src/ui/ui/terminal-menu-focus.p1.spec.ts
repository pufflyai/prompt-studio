import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: finishing a terminal load must not dismiss an existing tab menu before its action runs.
test("a terminal mounted after a menu opens preserves the selected menu action", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/terminal/terminal.canvas.tsx#LateMountPreservesMenuFocus",
  );
  const finish = preview.getByRole("menuitem", { name: "Finish pending terminal load", exact: true });
  await finish.click();
  await expect(preview.getByRole("textbox", { name: "Terminal input" })).toBeVisible();
  await expect(finish).toBeFocused();
  await preview.getByRole("menuitem", { name: "Close tab", exact: true }).click();
  await expect(preview.getByRole("textbox", { name: "Terminal input" })).toHaveCount(0);
});

// The menu that launches a terminal may close and return focus to its own trigger.
test("closing the launching menu still focuses its newly opened terminal", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/terminal/terminal.canvas.tsx#DeferredFocusIgnoresPopupRestore",
  );
  await preview.getByRole("menuitem", { name: "Open terminal", exact: true }).click();
  await expect(preview.getByRole("textbox", { name: "Terminal input" })).toBeFocused();
});
