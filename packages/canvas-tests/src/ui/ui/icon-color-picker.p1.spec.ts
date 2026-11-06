import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: every icon choice must fit inside the picker and remain clickable.
test("color and icon choices fit inside the popover with balanced horizontal padding", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/primitives/icon-color-picker.canvas.tsx#Default",
    "Popover open",
  );
  await preview.getByRole("button", { name: "Pick color and icon", exact: true }).click();
  const dialog = preview.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Read parent and choices together so the opening animation cannot move between samples.
  const { left, right } = await dialog.evaluate((element) => {
    const frame = element.getBoundingClientRect();
    const bounds = [...element.querySelectorAll("button")].map((button) => {
      const rect = button.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
    return {
      left: Math.min(...bounds.map((rect) => rect.left)) - frame.left,
      right: frame.right - Math.max(...bounds.map((rect) => rect.right)),
    };
  });
  expect(left).toBeGreaterThan(0);
  expect(right).toBeGreaterThan(0);
  expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
  const choices = dialog.getByRole("button");
  await choices.last().click();
  await expect(choices.last()).toHaveAttribute("aria-pressed", "true");
});
