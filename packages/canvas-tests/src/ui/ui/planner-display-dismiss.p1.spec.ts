import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: a display popover must close before the person can save the selected view.
test("closing Timeline display settings leaves Save view reachable", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "extensions/pstdio-planner/src/proposals/PS-292/timeline-display-menu.canvas.tsx#SaveDisplay",
  );
  if (process.env.PSTDIO_MENU_PROPOSAL === "1")
    await preview.getByRole("button", { name: "Use proposed fix", exact: true }).click();
  const trigger = preview.getByRole("button", { name: "Display settings", exact: true });
  await trigger.click();
  const menu = preview.getByRole("dialog", { name: "Display settings", exact: true });
  await menu.getByRole("button", { name: "ID", exact: true }).click();
  await trigger.click({ delay: 50 });
  await expect(menu).toBeHidden();
  await preview.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(preview.getByRole("status", { name: "Saved display properties" })).toContainText("id");
});
