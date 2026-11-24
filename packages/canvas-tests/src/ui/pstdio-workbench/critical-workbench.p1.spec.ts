import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: reopening status details must preserve the loaded view and return focus on close.
test("status details retain their state across closing and reopening", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/workbench/workbench-status-bar.canvas.tsx#DetailPopover",
  );
  const trigger = preview.getByRole("button", { name: "Activity", exact: true });
  await expect(preview.getByRole("button", { name: "Activity checked 0 times", includeHidden: true })).toHaveCount(0);
  const ticks = preview.locator("[data-activity-ticks]");
  await expect(ticks).toHaveCount(0);
  await trigger.click();
  await expect(preview.getByRole("button", { name: "Activity checked 0 times" })).toBeVisible();
  await expect(ticks).not.toHaveAttribute("data-activity-ticks", "0");
  await preview.getByRole("button", { name: "Activity checked 0 times" }).click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  const retained = preview.getByRole("button", { name: "Activity checked 1 times", includeHidden: true });
  await expect(retained).toBeHidden();
  await expect(retained).toHaveCount(1);
  const pausedTicks = await ticks.getAttribute("data-activity-ticks");
  await page.waitForTimeout(150);
  await expect(ticks).toHaveAttribute("data-activity-ticks", pausedTicks!);
  await trigger.press("Enter");
  await expect(preview.getByRole("button", { name: "Activity checked 1 times" })).toBeVisible();
});

// Critical: switching projects must not leak the preceding project's mutable view state.
test("switching projects starts project views fresh", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/workbench/project-switch.canvas.tsx#KeepsShellMounted",
  );
  await expect(preview.getByText("Project A content", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Notes edited 0 times" }).click();
  await expect(preview.getByRole("button", { name: "Notes edited 1 times" })).toBeVisible();
  await preview.getByRole("button", { name: "Open Project B" }).click();
  await expect(preview.getByText("Project B content", { exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Notes edited 0 times" })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Notes edited 1 times" })).toHaveCount(0);
});

// Critical: replacing an unpinned preview must preserve pinned resource tabs and their drafts.
test("resource previews share a tray and retain pinned tabs", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/examples/api/api.canvas.tsx#ResourceTabs",
  );
  const header = preview.locator('[data-workbench-panel-header="secondary"]');
  await preview.getByRole("button", { name: "Preview Alpha" }).click();
  const alpha = header.getByRole("tab", { name: "Alpha.md" });
  await expect(alpha).toBeVisible();
  await alpha.press("Shift+F10");
  await expect(preview.getByRole("menu", { name: "Alpha.md context menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview.getByRole("menu")).toHaveCount(0);
  await expect(alpha).toBeFocused();
  await preview.getByRole("button", { name: "Preview Beta" }).click();
  await expect(header.getByRole("tab", { name: "Alpha.md" })).toHaveCount(0);
  const beta = header.getByRole("tab", { name: "Beta.md" });
  await expect(beta).toBeVisible();
  await beta.click({ button: "right" });
  await preview.getByRole("menuitem", { name: "Pin tab", exact: true }).click();
  await preview.getByRole("button", { name: "Preview Alpha" }).click();
  await expect(header.getByRole("tab")).toHaveCount(2);
  await preview.getByRole("button", { name: "Preview Beta" }).click();
  await expect(header.getByRole("tab")).toHaveCount(2);
  await expect(beta).toHaveAttribute("aria-selected", "true");
});

// Critical: floating-panel drag handling must not block commands in portaled dropdown menus.
for (const movement of ["snap", "free"] as const) {
  test(`floating panel dropdowns create sessions in ${movement} mode`, async ({ page }) => {
    const preview = await openCanvasPreview(
      page,
      "packages/pstdio-workbench/src/react/region/panel-arrangement.canvas.tsx#DetachedSide",
    );
    const panel = preview.getByTestId("workbench-side-panel-floating");
    const header = panel.locator('[data-workbench-panel-header="side"]');
    if (movement === "free") {
      await header.press("Shift+F10");
      await preview.getByRole("menuitem", { name: "Move freely", exact: true }).click();
    }
    await expect(panel).toHaveAttribute("data-floating-panel-movement", movement);
    const original = panel.getByRole("tab", { name: "Session with a longer name 1", exact: true });
    await original.click();
    await panel.getByRole("textbox", { name: "Retained draft" }).fill("Keep the original draft");
    await header.getByRole("button", { name: "Add panel", exact: true }).click();
    await preview.getByRole("menuitem", { name: "Create session", exact: true }).click();
    await expect(panel.getByRole("tab")).toHaveCount(3);
    await expect(panel.getByRole("tab", { name: "New session", exact: true })).toHaveAttribute("aria-selected", "true");
    await original.click();
    await expect(panel.getByRole("textbox", { name: "Retained draft" })).toHaveValue("Keep the original draft");
    await original.click({ button: "right" });
    await preview.getByRole("menuitem", { name: "New session", exact: true }).click();
    await expect(panel.getByRole("tab")).toHaveCount(4);
    await original.click();
    await expect(panel.getByRole("textbox", { name: "Retained draft" })).toHaveValue("Keep the original draft");
  });
}

// Critical: moving a live panel must preserve its unsaved input.
test("moving a panel preserves its draft", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/region/panel-arrangement.canvas.tsx#ClosedBottom",
  );
  const source = preview.locator('[data-workbench-panel="side"]:visible');
  const tab = source.getByRole("tab", { selected: true });
  await source.getByRole("textbox", { name: "Retained draft" }).fill("Keep this draft");
  const box = (await tab.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2, { steps: 3 });
  await preview.locator('[data-workbench-edge-hit="secondary"][data-workbench-edge-position="bottom"]').hover();
  await page.mouse.up();
  await expect(
    preview.locator('[data-workbench-panel="secondary"]:visible').getByRole("textbox", { name: "Retained draft" }),
  ).toHaveValue("Keep this draft");
});

// Critical: moving an entire Bottom tray into closed Side must retain every live draft.
test("moving Bottom into closed Side swaps the complete tray without losing drafts", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/region/whole-panel-placement.canvas.tsx#Interactive",
  );
  const original = preview.locator('[data-workbench-panel="side"]:visible');
  const tabs = original.getByRole("tab");
  await expect(tabs).toHaveCount(2);
  await tabs.first().click();
  await original.getByRole("textbox", { name: "Retained draft" }).fill("First unsaved draft");
  await tabs.first().click({ button: "right" });
  await preview.getByRole("menuitem", { name: "Move to Secondary", exact: true }).click();
  await expect(tabs).toHaveCount(1);
  await tabs.first().click();
  await original.getByRole("textbox", { name: "Retained draft" }).fill("Second unsaved draft");
  await tabs.first().click({ button: "right" });
  await preview.getByRole("menuitem", { name: "Move to Secondary", exact: true }).click();
  const source = preview.locator('[data-workbench-panel="secondary"]:visible');
  await expect(source.getByRole("tab")).toHaveCount(2);
  const header = preview.locator('[data-workbench-panel-drag="secondary"]');
  const box = (await header.boundingBox())!;
  await page.mouse.move(box.x + box.width - 80, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 92, box.y + box.height / 2, { steps: 3 });
  const target = (await preview.locator('[data-workbench-edge-drop="panel-right"]').boundingBox())!;
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 6 });
  await page.mouse.up();
  const side = preview.locator('[data-workbench-panel="side"]:visible');
  await expect(side.getByRole("tab")).toHaveCount(2);
  await expect(source).toHaveCount(0);
  await expect(side.getByRole("textbox", { name: "Retained draft" })).toHaveValue("Second unsaved draft");
  await side.getByRole("tab").first().click();
  await expect(side.getByRole("textbox", { name: "Retained draft" })).toHaveValue("First unsaved draft");
});

// Critical: a single-tab drag must not swap its entire tray or reveal the hidden Side tray in Bottom.
test("single Bottom tabs use tab destinations while Side is closed", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/region/whole-panel-placement.canvas.tsx#Interactive",
  );
  const original = preview.locator('[data-workbench-panel="side"]:visible');
  await original.getByRole("tab").first().click({ button: "right" });
  await preview.getByRole("menuitem", { name: "Move to Secondary", exact: true }).click();
  await expect(original.getByRole("tab")).toHaveCount(1);
  await preview.getByRole("button", { name: "Hide Side Panel", exact: true }).click();
  const source = preview.locator('[data-workbench-panel="secondary"]:visible');
  const tab = source.getByRole("tab");
  await expect(tab).toHaveCount(1);
  await source.getByRole("textbox", { name: "Retained draft" }).fill("Single tab draft");
  const box = (await tab.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2, { steps: 3 });
  await expect(
    preview.locator('[data-workbench-edge-hit="secondary"][data-workbench-edge-position="left"]'),
  ).toHaveCount(0);
  await expect(
    preview.locator('[data-workbench-edge-hit="secondary"][data-workbench-edge-position="right"]'),
  ).toHaveCount(0);
  await preview.locator('[data-workbench-edge-hit="side"][data-workbench-edge-position="right"]').hover();
  await page.mouse.up();
  const side = preview.locator('[data-workbench-panel="side"]:visible');
  await expect(side.getByRole("tab")).toHaveCount(2);
  await expect(side.getByRole("textbox", { name: "Retained draft" })).toHaveValue("Single tab draft");
  await expect(source).toHaveCount(0);
});

// Critical: tab navigation must restore keyboard focus without losing the preceding draft.
test("keyboard tab navigation restores focus and draft state", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/keybindings/keyboard.canvas.tsx#VisiblePanels",
  );
  await preview.getByRole("tab", { name: "PS-1", exact: true }).click();
  await preview.getByRole("textbox", { name: "Draft 1", exact: true }).fill("Retained keyboard draft");
  await page.keyboard.press("Control+Tab");
  await expect(preview.getByRole("textbox", { name: "Draft 2", exact: true })).toBeFocused();
  await page.keyboard.press("Control+Shift+Tab");
  const draft = preview.getByRole("textbox", { name: "Draft 1", exact: true });
  await expect(draft).toBeFocused();
  await expect(draft).toHaveValue("Retained keyboard draft");
  const shortcuts = preview.locator("[data-keyboard-tab-shortcut]");
  await page.keyboard.down("Alt");
  await expect(shortcuts).toHaveCount(4);
  const targetLabelId = await shortcuts
    .filter({ hasText: /2$/ })
    .locator('xpath=ancestor::*[@role="tab"]')
    .getAttribute("aria-labelledby");
  const targetLabel = await preview.locator(`[id="${targetLabelId}"]`).textContent();
  await page.keyboard.up("Alt");
  await expect(shortcuts).toHaveCount(0);
  await page.keyboard.press("Alt+Shift+2");
  await expect(
    preview.getByRole("textbox", { name: `Draft ${targetLabel?.replace("PS-", "")}`, exact: true }),
  ).toBeFocused();
  await expect(preview.getByRole("region", { name: "Keyboard shortcut mode", exact: true })).toBeHidden();
  await preview.getByRole("tab", { name: "PS-1", exact: true }).click();
  await expect(draft).toHaveValue("Retained keyboard draft");
});
