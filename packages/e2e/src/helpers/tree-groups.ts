import { expect, type Locator, type Page } from "@playwright/test";
import { revealTreeEntry } from "./tree-entry";

export const verifyTreeGroups = async (page: Page, tree: Locator, source: Locator) => {
  await source.click({ button: "right" });
  await page.getByRole("menuitem", { name: "New group", exact: true }).click();
  const input = tree.getByRole("textbox", { name: "Group name", exact: true });
  await expect(input).toBeFocused();
  await input.fill("Research");
  await input.press("Enter");
  const group = tree.getByText("Research", { exact: true });
  await expect(group).toBeVisible();
  await group.click();

  const from = (await source.boundingBox())!;
  const to = (await group.boundingBox())!;
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + from.height / 2 + 8, { steps: 4 });
  await page.mouse.move(from.x + 40, to.y + to.height / 2, { steps: 12 });
  // A long tree auto-scrolls near its edge and moves the group, so follow it until it stops moving.
  await expect(async () => {
    const before = (await group.boundingBox())!;
    await page.mouse.move(from.x + 40, before.y + before.height / 2);
    expect((await group.boundingBox())!.y).toBe(before.y);
  }).toPass();
  await expect(tree.locator("[data-tree-list-drop-group]")).toHaveCount(1);
  await page.mouse.up();
  // A drop schedules the tree update. Wait for this row to belong to the group
  // before collapsing it, so the following click observes the updated layout.
  const rowId = await source.getAttribute("data-tree-list-focus-id");
  expect(rowId).toBeTruthy();
  const section = group.locator("xpath=ancestor::*[.//*[@data-tree-reveal]][1]");
  await expect(section.locator(`[data-tree-list-focus-id=${JSON.stringify(rowId)}]`)).toBeVisible();
  // dnd-kit suppresses clicks briefly after a drop.
  await page.waitForTimeout(100);
  await group.click();
  await expect(source).toHaveCount(0);
  await group.click();
  await expect(source).toBeVisible();

  await page.reload();
  await revealTreeEntry(page, tree, group);
  await expect(group).toBeVisible();
  await expect(source).toBeVisible();
  // A raw bounding box can point outside the clipped tree after it scrolls. Use the
  // locator's hit-tested hover and the actual pointer-down, not later layout geometry.
  const pointerDown = await group.evaluateHandle((element) => {
    const expectedId = element.closest("[data-tree-list-focus-id]")?.getAttribute("data-tree-list-focus-id");
    if (!expectedId) throw new Error("Group header has no tree identity");
    // The tree can replace its DOM nodes when contributions finish loading.
    // Compare the user's target with the saved group identity across that update.
    return {
      event: new Promise<{ x: number; y: number; onGroup: boolean; targetId: string | null }>((resolve) => {
        document.addEventListener(
          "pointerdown",
          (event) => {
            const header = (event.target as Element).closest("[data-tree-list-focus-id]");
            const targetId = header?.getAttribute("data-tree-list-focus-id") ?? null;
            resolve({ x: event.clientX, y: event.clientY, onGroup: targetId === expectedId, targetId });
          },
          { once: true, capture: true },
        );
      }),
    };
  });
  await group.hover();
  await page.mouse.down();
  const start = await pointerDown.evaluate(({ event }) => event);
  await pointerDown.dispose();
  expect(start.onGroup, `the gesture starts on the group header (target: ${start.targetId})`).toBe(true);
  await page.mouse.move(start.x, start.y - 35, { steps: 8 });
  await expect(page.locator("[data-panel-dragging]")).toHaveCount(0);
  await expect(page.locator("[data-workbench-edge-drop]")).toHaveCount(0);
  await page.mouse.up();
  await page.waitForTimeout(100);
  await group.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename group", exact: true }).click();
  await input.fill("Product research");
  await input.press("Enter");
  const renamed = tree.getByText("Product research", { exact: true });
  await expect(renamed).toBeVisible();
  await renamed.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove group", exact: true }).click();
  await expect(renamed).toHaveCount(0);
  await expect(source).toBeVisible();
};
