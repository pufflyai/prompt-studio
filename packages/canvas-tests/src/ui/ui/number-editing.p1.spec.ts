import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: closing a control during a drag must not turn its preview into a document edit.
test("leaving a numeric control during a pointer gesture cancels rather than completes it", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/param-editor/inputs/number-input.canvas.tsx#Editing",
  );
  const slider = preview.getByRole("slider", { name: "Opacity (%)", exact: true });
  const thumb = await slider.boundingBox();
  const track = await slider.locator("..").boundingBox();
  if (!thumb || !track) throw new Error("The numeric slider must be visible");
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width / 2, thumb.y + thumb.height / 2);
  await expect(preview.getByLabel("Preview opacity", { exact: true })).not.toHaveText("80");
  await expect(preview.getByLabel("Completed edits", { exact: true })).toHaveText("0");
  // The host can retire a view without a pointerup in the guest (for example through navigation).
  await preview
    .getByRole("button", { name: "Close control", exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.mouse.up();
  await expect(preview.getByLabel("Completed edits", { exact: true })).toHaveText("0");
  await expect(preview.getByLabel("Accepted opacity", { exact: true })).toHaveText("80");
  await expect(preview.getByLabel("Preview opacity", { exact: true })).toHaveText("80");
  await preview.getByRole("button", { name: "Reopen control", exact: true }).click();
  await expect(preview.getByRole("spinbutton", { name: "Opacity (%)", exact: true })).toHaveValue("80");
});

// Critical: invalid drafts and protected controls must not create edits or lose the accepted value.
test("numeric input completes once and preserves validation, cancellation and protected values", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/param-editor/inputs/number-input.canvas.tsx#Editing",
  );
  const input = preview.getByRole("spinbutton", { name: "Opacity (%)", exact: true });
  const edits = preview.getByLabel("Completed edits", { exact: true });
  await input.fill("");
  await input.press("Enter");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(edits).toHaveText("0");
  await input.press("Escape");
  await expect(input).toHaveValue("80");
  await input.fill("40");
  await input.press("ArrowUp");
  await expect(preview.getByLabel("Preview opacity", { exact: true })).toHaveText("41");
  await expect(edits).toHaveText("0");
  await input.press("Enter");
  await expect(preview.getByLabel("Accepted opacity", { exact: true })).toHaveText("41");
  await expect(edits).toHaveText("1");
  await input.fill("42");
  await input.press("Escape");
  await expect(input).toHaveValue("41");
  await expect(edits).toHaveText("1");
  await preview.getByRole("button", { name: "Read only", exact: true }).click();
  await expect(input).toHaveAttribute("readonly", "");
  await input.press("ArrowUp");
  await expect(input).toHaveValue("41");
  await preview.getByRole("button", { name: "Disable control", exact: true }).click();
  await expect(input).toBeDisabled();
  await expect(edits).toHaveText("1");
});
