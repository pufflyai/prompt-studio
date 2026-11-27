import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

test("a mounted board creation form can submit again after reopening", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/kanban-renderer/kanban-renderer-create-dialog.canvas.tsx#AttributesOnly",
  );
  const dialog = preview.getByRole("dialog", { name: "New ticket", exact: true });
  const create = dialog.getByRole("button", { name: "Create ticket", exact: true });

  await create.click();
  await expect(dialog).toBeHidden();

  await preview.getByRole("button", { name: "New ticket", exact: true }).click();
  await expect(create).toBeEnabled();
  await create.click();
  await expect(dialog).toBeHidden();
});
