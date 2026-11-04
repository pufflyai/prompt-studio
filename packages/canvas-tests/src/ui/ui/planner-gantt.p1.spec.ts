import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: ticket metadata and opening must stay usable beside the chart.
test("Gantt exposes ticket badges, opens a ticket, and keeps milestones off ticket rows", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "extensions/pstdio-planner/proposals/PS-1060/planner-updates.canvas.tsx#GanttViewPreview",
  );
  await expect(preview.getByRole("list", { name: "Scheduled tickets" }).getByRole("listitem")).toHaveCount(5);
  await expect(preview.locator('[data-ticket-id="schema"]').getByText("Done", { exact: true })).toBeVisible();
  for (const label of ["Foundation · 7h", "Preview · 9h", "Launch · 12h"]) {
    await expect(preview.locator("svg").getByText(label, { exact: true })).toBeVisible();
  }
  await preview.getByRole("button", { name: "Open Define project structure", exact: true }).click();
  const dialog = preview.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Define project structure" })).toBeVisible();
  await expect(dialog.getByText("DEMO-1", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await preview.getByRole("button", { name: "Display settings", exact: true }).click();
  await preview.getByRole("button", { name: "Priority", exact: true }).click();
  await expect(preview.locator('[data-ticket-id="schema"]').getByText("High", { exact: true })).toBeVisible();
});
