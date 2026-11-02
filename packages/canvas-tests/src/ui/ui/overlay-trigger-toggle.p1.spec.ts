import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: dismissal must leave the trigger usable instead of reopening an overlay.
for (const [name, role, content] of [
  ["Menu with an ID", "menu", undefined],
  ["Menu with a tooltip", "menu", undefined],
  ["Uncontrolled popover", "dialog", "Uncontrolled details"],
  ["Popover with an ID", "dialog", "Details"],
  ["Searchable menu", "menu", undefined],
  ["Resource actions", "menu", undefined],
  ["Row menu", "menu", undefined],
] as const) {
  test(`${name} closes when its trigger is clicked again`, async ({ page }) => {
    const preview = await openCanvasPreview(page, "packages/ui/src/utils/scoped-overlays.canvas.tsx#Buttons");
    const trigger = preview.getByRole("button", { name, exact: true });
    const overlay = preview.getByRole(role, content ? { name: content, exact: true } : {});
    await trigger.click();
    await expect(overlay).toBeVisible();
    await trigger.click();
    await expect(overlay).toBeHidden();
    await trigger.click();
    await expect(overlay).toBeVisible();
    await preview.getByRole("button", { name: "Outside", exact: true }).click();
    await expect(overlay).toBeHidden();
    await trigger.focus();
    await trigger.press("Enter");
    await expect(overlay).toBeVisible();
    await overlay.press("Escape");
    await expect(overlay).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test("Planner display settings close when their trigger is clicked again", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "extensions/pstdio-planner/src/timeline/view/timeline-display-menu.canvas.tsx#Properties",
  );
  const trigger = preview.getByRole("button", { name: "Display settings", exact: true });
  const overlay = preview.getByRole("dialog", { name: "Display settings", exact: true });
  await trigger.click();
  await expect(overlay).toBeVisible();
  await trigger.click();
  await expect(overlay).toBeHidden();
  await trigger.click();
  await expect(overlay).toBeVisible();
  await overlay.press("Escape");
  await expect(overlay).toBeHidden();
});
