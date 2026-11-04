import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: moving Main must keep its navigation controls and unsaved embedded content together.
test("the navigation header moves Main and preserves its live content", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/region/panel-arrangement.canvas.tsx#HeaderlessWebview",
  );
  const main = preview.locator('[data-workbench-panel="main"]');
  const nav = preview.locator('[data-workbench-region="nav"][data-workbench-panel-drag="main"]');
  const secondary = preview.locator('[data-workbench-panel="secondary"]');
  const draft = main.frameLocator('iframe[title="Headerless webview"]').getByRole("textbox", { name: "Webview draft" });
  await draft.fill("Keep Main's unsaved content");
  await expect(main.locator('[data-workbench-region="nav"]')).toBeVisible();
  await expect(nav).toHaveAttribute("data-panel-draggable", "true");
  await draft.press("Tab");
  await expect(preview.getByRole("separator", { name: "Resize Secondary Panel", exact: true })).toBeFocused();

  const start = (await nav.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 12, { steps: 3 });
  const destination = preview.locator('[data-workbench-edge-drop="panel-bottom"]');
  await expect(destination).toBeVisible();
  const target = (await destination.boundingBox())!;
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await expect(destination).toHaveAttribute("data-drop-active", "true");
  await page.mouse.up();
  await expect.poll(async () => (await main.boundingBox())!.y > (await secondary.boundingBox())!.y).toBe(true);
  await expect(main.locator('[data-workbench-region="nav"]')).toBeVisible();
  await expect(draft).toHaveValue("Keep Main's unsaved content");

  await nav.focus();
  await nav.press("Shift+F10");
  await preview.getByRole("menuitem", { name: "Move panel to top", exact: true }).click();
  await expect.poll(async () => (await main.boundingBox())!.y < (await secondary.boundingBox())!.y).toBe(true);
  await expect(draft).toHaveValue("Keep Main's unsaved content");

  await nav.getByRole("button", { name: "Enter Main fullscreen", exact: true }).click();
  await expect(nav).not.toHaveAttribute("data-panel-draggable", "true");
  await nav.getByRole("button", { name: "Exit Main fullscreen", exact: true }).click();
  await expect(draft).toHaveValue("Keep Main's unsaved content");

  await nav.getByRole("button", { name: "Hide Bottom Panel", exact: true }).click();
  await expect(secondary).toBeHidden();
  await expect(nav).not.toHaveAttribute("data-panel-draggable", "true");
  await expect(preview.locator('[data-workbench-edge-drop^="panel-"]')).toHaveCount(0);
});
