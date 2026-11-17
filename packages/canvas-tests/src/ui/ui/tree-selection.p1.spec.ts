import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: selection changes must preserve focus, range selection, and sibling moves.
test("tree rows retain selection and keyboard moves after changing the active row", async ({ page }) => {
  const frame = await openCanvasPreview(
    page,
    "packages/ui/src/components/tree-list/tree-list-outliner.canvas.tsx#ControlledAuthoringRows",
  );
  const title = frame.getByRole("option", { name: "Title", exact: true });
  const artwork = frame.getByRole("option", { name: "Artwork", exact: true });
  await title.click();
  await artwork.click({ modifiers: ["Shift"] });
  await expect(title).toHaveAttribute("aria-selected", "true");
  await expect(artwork).toHaveAttribute("aria-selected", "true");
  await expect(frame.getByRole("status")).toHaveText("Selected: title, artwork");
  await artwork.press("Space");
  await expect(title).toHaveAttribute("aria-selected", "false");
  await expect(frame.getByRole("status")).toHaveText("Selected: artwork");
  await artwork.press("Alt+ArrowUp");
  await expect(frame.getByRole("option").first()).toHaveAttribute("data-tree-list-node-id", "artwork");
  await expect(artwork).toBeFocused();
});

test("virtual tree selection follows keyboard focus to a row outside the viewport", async ({ page }) => {
  const frame = await openCanvasPreview(
    page,
    "packages/ui/src/components/tree-list/tree-list-outliner.canvas.tsx#VirtualRangeSelection",
  );
  const first = frame.getByRole("option", { name: "Layer 0", exact: true });
  await first.click();
  await first.press("Shift+ArrowDown");
  const second = frame.getByRole("option", { name: "Layer 1", exact: true });
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(first).toHaveAttribute("aria-selected", "true");
  await second.press("End");
  const last = frame.getByRole("option", { name: "Layer 59", exact: true });
  await expect(last).toBeFocused();
  await last.press("Space");
  await expect(frame.getByRole("status")).toHaveText("Selected: row-59");
});
