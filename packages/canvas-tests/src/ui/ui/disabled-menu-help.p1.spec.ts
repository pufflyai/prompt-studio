import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: a pending composer focus request must not interrupt another keyboard task when it becomes editable.
test("composer readiness keeps focus on the session row the person selected", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/rich-text/prompt-input/prompt-input-focus.canvas.tsx#ChosenRow",
  );
  const row = preview.getByRole("option", { name: "Waiting for input", exact: true });
  await row.focus();
  await expect(preview.getByRole("status")).toHaveText("Loading finished");
  await expect(row).toBeFocused();
});

test("composer readiness keeps a chosen menu explanation focused", async ({ page }, testInfo) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/rich-text/prompt-input/prompt-input-focus.canvas.tsx#ChosenMenuHelp",
  );
  await page.frameLocator("[data-verification-host]").locator("[data-canvas-viewport]").press("0");
  const row = preview.getByRole("option", { name: "Waiting for input", exact: true });
  await row.focus();
  await page.keyboard.press("ContextMenu");
  await expect(preview.getByRole("menuitem", { name: /^Delete session/ })).toHaveAttribute("data-disabled");
  await page.keyboard.press("Tab");
  await expect(preview.getByRole("status")).toHaveText("Loading finished");
  await expect(preview.getByLabel("Stop active or queued work before deleting.", { exact: true })).toBeFocused();
  await expect(preview.getByText("Stop active or queued work before deleting.", { exact: true })).toBeVisible();
  const menu = (await preview.getByRole("menu").boundingBox())!;
  const tip = (await preview.getByText("Stop active or queued work before deleting.", { exact: true }).boundingBox())!;
  const x = Math.max(0, Math.min(menu.x, tip.x) - 12);
  const y = Math.max(0, Math.min(menu.y, tip.y) - 12);
  await page.screenshot({
    path: testInfo.outputPath("composer-menu-focus-design.png"),
    clip: {
      x,
      y,
      width: Math.max(menu.x + menu.width, tip.x + tip.width) - x + 12,
      height: Math.max(menu.y + menu.height, tip.y + tip.height) - y + 12,
    },
  });
  await page.keyboard.press("Escape");
  await expect(preview.getByRole("menu")).toHaveCount(0);
});

// A normal pending request must still focus the composer after Unlock; another chosen field keeps focus.
test("an unlocked composer still receives its pending focus request", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/chat-ui/components/chat-input-delayed-enable.canvas.tsx#AutoFocusWhenUnlocked",
  );
  const editor = preview.locator('[contenteditable="false"]');
  await expect(editor).toBeVisible();
  await preview.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(preview.locator('[contenteditable="true"]')).toBeFocused();
});

test("a chosen text field keeps focus while a requested composer unlocks", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/chat-ui/components/chat-input-delayed-enable.canvas.tsx#KeepsFocusInAnotherField",
  );
  await preview.getByRole("button", { name: "Load request", exact: true }).click();
  const notes = preview.getByRole("textbox", { name: "Notes", exact: true });
  await notes.fill("Keep my keyboard here");
  await expect(preview.locator('[contenteditable="true"]')).toBeVisible();
  await expect(notes).toBeFocused();
});
