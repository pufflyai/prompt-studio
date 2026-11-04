import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: a pending composer focus request must not interrupt another keyboard task when it becomes editable.
test("composer readiness keeps focus on the session row the person selected", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/proposals/PS-1049/disabled-menu-help.canvas.tsx#ChosenRow",
  );
  const row = preview.getByRole("option", { name: "Waiting for input", exact: true });
  await row.focus();
  await expect(preview.getByRole("status")).toHaveText("Loading finished");
  await expect(row).toBeFocused();
});

test("composer readiness keeps a chosen menu explanation focused", async ({ page }, testInfo) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/proposals/PS-1049/disabled-menu-help.canvas.tsx#ChosenMenuHelp",
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
