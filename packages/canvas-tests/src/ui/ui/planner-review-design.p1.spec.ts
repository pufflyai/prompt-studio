import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: resolving requests must update the milestone bubble and retain a connected keyboard target.
test("milestone preview updates attention counts and restores focus after its final answer", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "extensions/pstdio-planner/src/timeline/view/requests-panel.canvas.tsx#MilestoneModal",
  );
  const indicator = preview.getByRole("button", {
    name: "Open 2 tickets needing attention in Notes tool preview",
    exact: true,
  });
  await indicator.dispatchEvent("click");
  const modal = preview.getByRole("dialog", { name: "Notes tool preview", exact: true });
  await modal.getByRole("button", { name: "Open session", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText("Session navigation is unavailable in this isolated preview.");
  await modal.getByRole("radio", { name: /Offer a backup file/ }).press("Space");
  await modal.getByRole("button", { name: "Submit answer", exact: true }).click();
  await modal.getByRole("radio", { name: /Invite specific people/ }).press("Space");
  await modal.getByRole("button", { name: "Submit answer", exact: true }).click();
  await modal.press("Escape");
  const remaining = preview.getByRole("button", {
    name: "Open 1 tickets needing attention in Notes tool preview",
    exact: true,
  });
  await expect(remaining).toBeFocused();
  await remaining.press("Enter");
  await modal.getByRole("radio", { name: /Start with CSV/ }).press("Space");
  await modal.getByRole("button", { name: "Submit answer", exact: true }).click();
  await modal.press("Escape");
  await expect(preview.getByRole("button", { name: /tickets needing attention/ })).toHaveCount(0);
  await expect(preview.getByRole("button", { name: "Collapse Notes tool preview", exact: true })).toBeFocused();
});
