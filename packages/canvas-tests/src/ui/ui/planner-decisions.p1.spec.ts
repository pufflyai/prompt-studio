import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const canvas = "extensions/pstdio-planner/src/timeline/view/requests-panel.canvas.tsx";

// Critical: people must be able to answer a card decision and return to the same keyboard control.
test("card decisions preserve drafts across navigation and restore focus after submission", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#CardModal`);
  const card = preview.getByRole("button", { name: "PS-32 Ship the preview", exact: true });
  await card.focus();
  await card.press("Enter");
  const modal = preview.getByRole("dialog", { name: "PS-32 · Ship the preview" });
  await expect(modal).toBeVisible();
  await modal.getByText("2. Several tags at once", { exact: true }).click();
  await modal.getByRole("button", { name: "Next", exact: true }).click();
  await expect(modal.getByText("Choose the release scope", { exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(modal.getByRole("radio", { name: /Several tags at once/ })).toBeChecked();
  await modal.getByRole("button", { name: "Submit answer", exact: true }).click();
  await expect(modal.getByText("Choose the release scope", { exact: true })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Previous", exact: true })).toHaveCount(0);
  await modal.press("Escape");
  await expect(modal).toBeHidden();
  await expect(card).toBeFocused();
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
