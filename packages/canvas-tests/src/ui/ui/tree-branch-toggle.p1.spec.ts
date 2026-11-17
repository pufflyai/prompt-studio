import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: expanding a page that has children must not open the page again. Re-opening reconciles
// the page layout, which stalled the Notes sidenav toggle for most of a second.
test("a page branch expands from its chevron without opening the page", async ({ page }) => {
  const frame = await openCanvasPreview(
    page,
    "packages/ui/src/components/tree-list/tree-list-branch-navigation.canvas.tsx#PageAndChildren",
  );
  const notes = frame.getByRole("option", { name: "Notes", exact: true });
  const child = frame.getByRole("option", { name: "First note", exact: true });
  await frame.getByRole("button", { name: "Expand group", exact: true }).click();
  await expect(notes).toHaveAttribute("aria-expanded", "true");
  await expect(child).toBeVisible();
  await expect(frame.getByRole("status")).toHaveText("Nothing open");
  await frame.getByRole("button", { name: "Collapse group", exact: true }).click();
  await expect(child).toHaveCount(0);
  await expect(frame.getByRole("status")).toHaveText("Nothing open");
  await notes.click();
  await expect(frame.getByRole("status")).toHaveText("Notes");
});
