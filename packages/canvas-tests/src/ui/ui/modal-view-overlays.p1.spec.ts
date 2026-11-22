import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const frame = "packages/ui/src/utils/scoped-overlays-modal-view.canvas.tsx#RetainedView";

// Critical: a retained view's popup must not remain over the destination inside an open modal.
test("a popup inside a modal follows its retained view", async ({ page }) => {
  const preview = await openCanvasPreview(page, frame);
  const dialog = preview.getByRole("dialog", { name: "Retained modal", exact: true });
  const draft = dialog.getByRole("textbox", { name: "Modal draft", exact: true });
  await draft.fill("Keep my modal draft");
  const trigger = dialog.getByRole("button", { name: "Modal options", exact: true });
  const popup = preview.getByRole("dialog", { name: "Modal options", exact: true });
  await trigger.click();
  await expect(popup).toBeVisible();
  // Navigation originates inside the popup, so no outside pointer-down dismisses it first.
  await popup.getByRole("button", { name: "Next view from options", exact: true }).click();
  await expect(dialog.getByText("Second modal view", { exact: true })).toBeVisible();
  await expect(popup).toBeHidden();
  await dialog.getByRole("button", { name: "First view", exact: true }).click();
  await expect(draft).toHaveValue("Keep my modal draft");
  await expect(popup).toBeHidden();
  await trigger.click();
  await expect(popup).toBeVisible();
  await popup.press("Escape");
  await expect(popup).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(dialog).toBeVisible();
});

// Critical: a deeper dialog keeps popup interaction and focus inside its own modal owner.
test("a deeper dialog keeps its popup owner inside a retained modal view", async ({ page }) => {
  const preview = await openCanvasPreview(page, frame);
  await preview.getByRole("button", { name: "Open nested modal", exact: true }).click();
  const nested = preview.getByRole("dialog", { name: "Nested modal", exact: true });
  const trigger = nested.getByRole("button", { name: "Nested options", exact: true });
  await trigger.click();
  const popup = preview.getByRole("dialog", { name: "Nested options", exact: true });
  await popup.getByRole("button", { name: "Keep nested choice", exact: true }).click();
  await expect(nested.getByText("Nested choice kept", { exact: true })).toBeVisible();
  await popup.press("Escape");
  await expect(popup).toBeHidden();
  await expect(trigger).toBeFocused();
  await nested.getByRole("button", { name: "Back to retained modal", exact: true }).click();
  await expect(nested).toBeHidden();
  await expect(preview.getByRole("dialog", { name: "Retained modal", exact: true })).toBeVisible();
});
