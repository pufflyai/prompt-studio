import { test } from "bun:test";
import { expect } from "@playwright/test";
import { verifyBoardEdgeScrolling } from "./packaged-board-edge-scrolling";
import { withPackagedBoard } from "./packaged-board-fixture";
import { verifyBoardPanning } from "./packaged-board-panning";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { verifyTicketCreation } from "./packaged-ticket-creation";

setupPackagedSmokeTests();

const allowance = process.platform === "win32" ? 60_000 : 30_000;

test("packaged Planner board pans with a mouse", () => withPackagedBoard(verifyBoardPanning), allowance);

test(
  "packaged Planner board scrolls at drag edges and preserves the drop",
  () => withPackagedBoard(verifyBoardEdgeScrolling),
  allowance,
);

test(
  "packaged Planner board keeps column and ticket actions",
  () =>
    withPackagedBoard(async (page) => {
      await verifyBoardPanning(page);
      const edgeCard = page.getByTestId("renderer-card").filter({ hasText: "Edge scroll ticket" });
      const done = page.getByTestId("board-column-done");
      const viewport = page
        .locator('[data-scope="scroll-area"][data-part="viewport"]')
        .filter({ has: page.getByTestId("board-column-backlog") })
        .last();
      const bounds = await viewport.boundingBox();
      const cardBounds = await edgeCard.boundingBox();
      if (!bounds || !cardBounds) throw new Error("Board or card has no bounds");
      const y = cardBounds.y + cardBounds.height / 2;
      await page.mouse.move(cardBounds.x + cardBounds.width / 2, y);
      await page.mouse.down();
      try {
        await page.mouse.move(bounds.x + bounds.width - 48, y, { steps: 4 });
        await page.mouse.move(bounds.x + bounds.width - 48, y);
        await expect
          .poll(() => viewport.evaluate((element) => element.scrollWidth - element.clientWidth - element.scrollLeft))
          .toBeLessThan(2);
        const doneBounds = await done.boundingBox();
        if (!doneBounds) throw new Error("Done column has no bounds");
        await page.mouse.move(doneBounds.x + doneBounds.width / 2, y, { steps: 4 });
        await page.mouse.move(doneBounds.x + doneBounds.width / 2, y);
      } finally {
        await page.mouse.up();
      }
      await expect(done.getByText("Edge scroll ticket", { exact: true })).toBeVisible();
      const doneCard = page.getByTestId("renderer-card").filter({ hasText: "Completed board ticket" });
      await doneCard.scrollIntoViewIfNeeded();
      await page.getByRole("button", { name: "Column actions for Done", exact: true }).click();
      await page.getByRole("menuitem", { name: "Archive all", exact: true }).click();
      await expect(doneCard).toBeHidden();
      await page.getByTestId("board-column-backlog").scrollIntoViewIfNeeded();
      await verifyTicketCreation(page);
      await page.getByTestId("renderer-card").filter({ hasText: "Pan board ticket" }).click();
      await expect(page.getByTestId("board-column-backlog")).toBeHidden();
    }),
  allowance,
);
