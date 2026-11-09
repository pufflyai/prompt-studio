import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: changing the rendering strategy must keep the last card reachable by keyboard.
test("board keyboard navigation reaches the last card before and after resizing", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/kanban-renderer/kanban-renderer-scrolling.canvas.tsx#OverflowingCards",
  );
  const first = preview.getByRole("button", { name: /^Ticket 1\./ });
  const last = preview.getByRole("button", { name: /^Ticket 60\./ });
  await first.focus();
  await first.press("End");
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport();

  await preview.getByRole("button", { name: "Show 40 cards", exact: true }).click();
  const smallLast = preview.getByRole("button", { name: /^Ticket 40\./ });
  await first.focus();
  await first.press("End");
  await expect(smallLast).toBeFocused();
  await expect(smallLast).toBeInViewport();

  await preview.getByRole("button", { name: "Keep one card", exact: true }).click();
  await expect(first).toBeInViewport();
  await expect(preview.getByTestId("renderer-card")).toHaveCount(1);
});
