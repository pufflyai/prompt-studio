import { expect, type Page } from "@playwright/test";

export const verifyPanelInsertionTargets = async (page: Page) => {
  const main = page.locator('[data-workbench-panel="main"]');
  for (const [region, edge] of [
    ["side", "left"],
    ["secondary", "top"],
  ] as const) {
    const header = page.getByLabel(region === "side" ? "Side panel header" : "Bottom panel header", { exact: true });
    const source = (await header.boundingBox())!;
    await page.mouse.move(source.x + 3, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + 15, source.y + source.height / 2, { steps: 3 });
    const target = page.locator(`[data-workbench-edge-drop="panel-${edge}"]`);
    await expect(target).toBeVisible();
    const slot = (await target.boundingBox())!;
    const content = (await main.boundingBox())!;
    if (region === "side") expect(slot.x + slot.width).toBeLessThanOrEqual(content.x);
    else expect(slot.y + slot.height).toBeLessThanOrEqual(content.y);
    await expect(page.locator('[data-workbench-edge-drop^="panel-"]')).toHaveCount(1);
    await page.mouse.move(content.x + content.width / 3, content.y + content.height / 3, { steps: 6 });
    await expect(target).toHaveAttribute("data-drop-active", "true");
    await expect(target.locator("[data-workbench-insertion-line]")).toBeVisible();
    const fill = await target.evaluate((element) => getComputedStyle(element, "::after").backgroundColor);
    expect(fill).not.toBe("rgba(0, 0, 0, 0)");
    await page.mouse.up();
  }
  await page.reload();
  for (const region of ["side", "secondary"] as const) {
    const panel = page.locator(`[data-workbench-panel="${region}"]:visible`);
    await expect(panel).toBeVisible();
    await expect
      .poll(async () => {
        const moved = (await panel.boundingBox())!;
        const content = (await main.boundingBox())!;
        return region === "side" ? moved.x < content.x : moved.y < content.y;
      })
      .toBe(true);
  }
};
