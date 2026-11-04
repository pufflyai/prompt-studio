import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: badge pointer and keyboard activation must not open or drag its ticket.
for (const example of ["TicketResources", "ListResources"]) {
  test(`${example}: linked badges open their resource without activating or dragging the ticket`, async ({ page }) => {
    const frame = await openCanvasPreview(
      page,
      `packages/ui/src/components/kanban-renderer/collection-badge.canvas.tsx#${example}`,
    );
    const workspace = frame.getByRole("button", { name: "Working copy" });
    await workspace.click();
    await expect(frame.getByRole("status")).toHaveText("Opened: Workspace; Drags: 0");
    const artifact = frame.getByRole("button", { name: "Prototype" });
    await artifact.focus();
    await artifact.press("Enter");
    await expect(frame.getByRole("status")).toHaveText("Opened: Artifact; Drags: 0");
    await workspace.focus();
    await workspace.press("Space");
    await expect(frame.getByRole("status")).toHaveText("Opened: Workspace; Drags: 0");
    const box = (await workspace.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 10 });
    await page.mouse.up();
    await expect(frame.getByRole("status")).toHaveText("Opened: Workspace; Drags: 0");
    await frame.getByText("Saved resource", { exact: true }).click();
    await expect(frame.getByRole("status")).toHaveText("Opened: Workspace; Drags: 0");
    await frame.getByText("Open related work", { exact: true }).click();
    await expect(frame.getByRole("status")).toHaveText("Opened: Ticket; Drags: 0");
  });
}
