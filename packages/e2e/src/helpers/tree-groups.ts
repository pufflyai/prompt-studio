import { expect, type Locator, type Page } from "@playwright/test";

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
  // dnd-kit suppresses clicks briefly after a drop.
  await page.waitForTimeout(100);
  await group.click();
  await expect(source).toHaveCount(0);
  await group.click();
  await expect(source).toBeVisible();

  await page.reload();
  await expect(group).toBeVisible();
  await expect(source).toBeVisible();
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
