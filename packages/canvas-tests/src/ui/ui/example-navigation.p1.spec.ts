import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: consolidating frames must keep their examples reachable by keyboard.
test("a single component frame exposes its disabled and interactive states", async ({ page }) => {
  const preview = await openCanvasPreview(page, "packages/ui/src/components/primitives/switch.canvas.tsx#Default");
  const examples = preview.getByRole("button", { name: "Choose example", exact: true });
  await examples.focus();
  await examples.press("Enter");
  const menu = preview.getByRole("menu", { name: "Choose example", exact: true });
  await menu.press("End");
  await menu.press("ArrowUp");
  await menu.press("ArrowUp");
  await menu.press("Enter");
  await expect(preview.getByRole("checkbox")).toBeChecked();
  await expect(preview.getByRole("checkbox")).toBeDisabled();
  await examples.click();
  await preview.getByRole("menuitem", { name: "Default", exact: true }).click();
  const toggle = preview.getByRole("checkbox");
  await expect(toggle).toBeEnabled();
  await toggle.press("Space");
  await expect(toggle).toBeChecked();
});
