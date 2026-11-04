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

// Critical: inspecting Auto Build must not repeatedly reopen its activity panel.
test("Auto Build activity closes when the Auto Build button is clicked again", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "extensions/pstdio-planner/src/timeline/view/auto-build-button.canvas.tsx#Waiting",
  );
  const trigger = preview.getByRole("button", { name: "Auto Build", exact: true });
  const activity = preview.getByRole("dialog", { name: "Auto Build activity", exact: true });
  await trigger.click();
  await expect(activity).toBeVisible();
  await trigger.click();
  await expect(activity).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(activity).toBeVisible();
  await activity.press("Escape");
  await expect(activity).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("Auto Build opens configuration when it is off", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "extensions/pstdio-planner/src/timeline/view/auto-build-button.canvas.tsx#Off",
  );
  await preview.getByRole("button", { name: "Auto Build", exact: true }).click();
  const configuration = preview.getByRole("dialog", { name: "Auto Build", exact: true });
  await expect(configuration).toBeVisible();
  await expect(preview.getByRole("dialog", { name: "Auto Build activity", exact: true })).toHaveCount(0);
  await configuration.press("Escape");
  await expect(configuration).toBeHidden();
});

// Critical: selecting a resource tab must dismiss its context menu without changing tabs.
test("clicking a tab closes its right-click menu", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/examples/api/api.canvas.tsx#ResourceTabs",
  );
  await preview.getByRole("button", { name: "Preview Beta", exact: true }).click();
  const tab = preview.getByRole("tab", { name: "Beta.md", exact: true });
  const menu = preview.getByRole("menu", { name: "Beta.md context menu", exact: true });
  await tab.click({ button: "right" });
  await expect(menu).toBeVisible();
  // The context menu starts at the right-click point, so its label covers the tab's center.
  // Click the still-visible edge as a person would, rather than asking Playwright to click through it.
  await tab.click({ position: { x: 4, y: 4 } });
  await expect(menu).toBeHidden();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await tab.press("Shift+F10");
  await expect(menu).toBeVisible();
  await menu.press("Escape");
  await expect(menu).toBeHidden();
  await expect(tab).toBeFocused();
});
