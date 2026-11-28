import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: a visible column can have matching cards even when the first page contains none of them.
test("the board loads successive pages for an empty column and keeps focus during continuation", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/kanban-renderer/paged-board.canvas.tsx#UnloadedColumn",
  );
  const todo = preview.getByTestId("board-column-todo");
  const first = todo.getByRole("button", { name: "Card 175", exact: true });
  await expect(first).toBeVisible();
  await expect(todo.getByRole("button", { name: /load more/i })).toHaveCount(0);
  await first.focus();
  await first.press("End");
  await expect(todo.getByRole("button", { name: "Card 200", exact: true })).toBeVisible();
  const previousLast = todo.getByRole("button", { name: "Card 199", exact: true });
  await expect(previousLast).toBeFocused();
  await expect(previousLast).toBeInViewport();
});

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
