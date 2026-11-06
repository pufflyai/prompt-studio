import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: a noninteractive tooltip must not block an essential action beneath its floating layer.
test("a noninteractive tooltip allows a nearby action underneath its positioner", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/primitives/tooltip.canvas.tsx#Default",
    "Pointer through",
  );
  await expect(preview.getByRole("tooltip")).toBeVisible();
  await preview.getByRole("button", { name: "Nearby action", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Action completed", exact: true })).toBeVisible();
});

test("an interactive tooltip retains its own action", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/primitives/tooltip.canvas.tsx#Default",
    "Interactive",
  );
  await preview.getByRole("button", { name: "Tooltip action", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Tooltip action completed", exact: true })).toBeVisible();
});
