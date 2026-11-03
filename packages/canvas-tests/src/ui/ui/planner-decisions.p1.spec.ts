import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const canvas = "extensions/pstdio-planner/src/timeline/view/requests-panel.canvas.tsx";

// Critical: people must be able to answer a card decision and return to the same keyboard control.
test("card decisions preserve drafts across navigation and restore focus after submission", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#CardModal`);
  const card = preview.getByRole("button", { name: "PS-32 Ship the preview", exact: true });
  await card.focus();
  await card.press("Enter");
  await expect(preview.getByRole("dialog")).toHaveCount(0);
  const indicator = preview.getByRole("button", { name: /items? need[s]? attention/, exact: false });
  await indicator.press("Enter");
  const modal = preview.getByRole("dialog", { name: "PS-32 · Ship the preview" });
  await expect(modal).toBeVisible();
  await modal.getByText("2. Several tags at once", { exact: true }).click();
  await modal.getByRole("button", { name: "Next", exact: true }).click();
  await expect(modal.getByText("Choose the release scope", { exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(modal.getByRole("radio", { name: /Several tags at once/ })).toBeChecked();
  await modal.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(modal.getByText("Choose the release scope", { exact: true })).toBeVisible();
  await expect(modal.locator('[tabindex="-1"]').filter({ hasText: "Choose the release scope" }).last()).toBeFocused();
  await expect(modal.getByRole("button", { name: "Previous", exact: true })).toHaveCount(0);
  await modal.press("Escape");
  await expect(modal).toBeHidden();
  await expect(indicator).toBeFocused();
  await indicator.press("Enter");
  await expect(modal.getByText("Choose the release scope", { exact: true })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Previous", exact: true })).toHaveCount(0);
});

// Critical: the constrained popover must keep the answer usable and retain it after a failed write.
test("Auto Build answers stay inline and save failures keep the selected choice", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#AutoBuildSaveError`);
  const activity = preview.getByRole("dialog", { name: "Auto Build", exact: true });
  await expect(activity).toBeVisible();
  await activity.getByText("2. Several tags at once", { exact: true }).click();
  await activity.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(activity.getByRole("alert")).toContainText("Unable to save. Try again.");
  await expect(activity.getByRole("radio", { name: /Several tags at once/ })).toBeChecked();
  await expect(activity.getByRole("button", { name: "Submit answer", exact: true })).toBeEnabled();
});

// Critical: resolved indicators must still offer access to saved answers.
test("a resolved card indicator opens its editable saved decision", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#ResolvedCard`);
  const card = preview.getByRole("button", { name: "PS-32 Ship the preview", exact: true });
  const indicator = preview.getByRole("button", { name: "1 item resolved", exact: true });
  await card.focus();
  // Safari mouse activation does not focus buttons. Dispatching click exercises that path.
  await indicator.dispatchEvent("click");
  const modal = preview.getByRole("dialog", { name: "PS-32 · Ship the preview" });
  await expect(modal.getByRole("button", { name: "Update answer", exact: true })).toBeEnabled();
  await expect(modal.getByRole("radio", { name: /Preview/ })).toBeChecked();
  await modal.press("Escape");
  await expect(indicator).toBeFocused();
});

// Critical: milestone attention must use the scoped review modal and return to its activating bubble.
test("milestone attention opens decisions across its tickets in the modal", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#MilestoneModal`);
  const indicator = preview.getByRole("button", {
    name: "Open 2 tickets needing attention in Notes tool preview",
    exact: true,
  });
  await indicator.dispatchEvent("click");
  const modal = preview.getByRole("dialog", { name: "Notes tool preview", exact: true });
  await expect(modal.getByText("PS-32 · Choose how tag filtering works", { exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "Next", exact: true }).click();
  await expect(modal.getByText("Choose the release scope", { exact: true })).toBeVisible();
  await expect(modal.getByText("PS-33 · Import notes", { exact: true })).toBeVisible();
  await modal.press("Escape");
  await expect(indicator).toBeFocused();
  await indicator.press("Enter");
  await modal.getByRole("radio", { name: /Preview/ }).press("Space");
  await modal.getByRole("tab", { name: "Limits (not answered)", exact: true }).click();
  await modal.getByRole("textbox").fill("Internal project first.");
  await modal.getByRole("button", { name: "Submit answer", exact: true }).click();
  await modal.press("Escape");
  const remaining = preview.getByRole("button", {
    name: "Open 1 tickets needing attention in Notes tool preview",
    exact: true,
  });
  await expect(remaining).toBeFocused();
  await remaining.press("Enter");
  await modal.getByText("2. Several tags at once", { exact: true }).click();
  await modal.getByRole("button", { name: "Submit answer", exact: true }).click();
  await modal.press("Escape");
  await expect(preview.getByRole("button", { name: "Collapse Notes tool preview", exact: true })).toBeFocused();
  await expect(preview.getByRole("button", { name: /tickets needing attention/ })).toHaveCount(0);
});

// Critical: a newly resolved indicator must open the saved answer after the last pending decision is submitted.
test("a pending card becomes an editable resolved decision after submission", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#CardModal`);
  await preview.getByRole("button", { name: "2 items need attention", exact: true }).press("Enter");
  const modal = preview.getByRole("dialog", { name: "PS-32 · Ship the preview" });
  await modal.getByText("2. Several tags at once", { exact: true }).click();
  await modal.getByRole("button", { name: "Submit answer", exact: true }).click();
  await modal.getByRole("radio", { name: /Preview/ }).press("Space");
  await modal.getByRole("tab", { name: "Limits (not answered)", exact: true }).click();
  await modal.getByRole("textbox").fill("Internal project first.");
  await modal.getByRole("button", { name: "Submit answer", exact: true }).click();
  await modal.press("Escape");
  const resolved = preview.getByRole("button", { name: "2 items resolved", exact: true });
  await resolved.press("Enter");
  await expect(modal.getByRole("button", { name: "Update answer", exact: true })).toHaveCount(2);
});
