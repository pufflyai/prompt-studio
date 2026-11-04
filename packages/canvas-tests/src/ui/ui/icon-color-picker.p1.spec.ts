import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: every icon choice must fit inside the picker and remain clickable.
test("color and icon choices fit inside the popover with balanced horizontal padding", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/primitives/icon-color-picker.canvas.tsx#PopoverOpen",
  );
  await preview.getByRole("button", { name: "Pick color and icon", exact: true }).click();
  const dialog = preview.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const frame = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, width: rect.width };
  });
  const choices = dialog.getByRole("button");
  const bounds = await choices.evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    }),
  );
  const left = Math.min(...bounds.map((rect) => rect.left)) - frame.x;
  const right = frame.x + frame.width - Math.max(...bounds.map((rect) => rect.right));
  expect(left).toBeGreaterThan(0);
  expect(right).toBeGreaterThan(0);
  expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
  await choices.last().click();
  await expect(choices.last()).toHaveAttribute("aria-pressed", "true");
});
