import { expect, type Page } from "@playwright/test";

export const verifyPanelInsertionTargets = async (page: Page) => {
  const main = page.locator('[data-workbench-panel="main"]');
  const edge = page.getByLabel("Main header edge", { exact: true });
  await expect(edge).toBeVisible();
  await edge.focus();
  await expect(edge).toBeFocused();
  await edge.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Show header", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Show header", exact: true }).click();
  await expect(main.getByRole("tab", { name: "Start", exact: true })).toBeVisible();
  for (const [region, edge] of [
    ["side", "left"],
    ["secondary", "top"],
  ] as const) {
    const header = page.getByLabel(region === "side" ? "Side panel header" : "Bottom panel header", { exact: true });
    await header.focus();
    await header.press("Shift+F10");
    await expect(page.getByRole("menuitem", { name: /^Move panel to / })).toHaveCount(1);
    await expect(page.getByRole("menuitem", { name: `Move panel to ${edge}`, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
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
    await expect(target).toBeEmpty();
    const fill = await target.evaluate((element) => getComputedStyle(element, "::after").backgroundColor);
    expect(fill).not.toBe("rgba(0, 0, 0, 0)");
    await page.mouse.up();
  }
  const mainHeader = page.getByLabel("Main panel header", { exact: true });
  await expect(main.locator('[data-workbench-panel-drag="main"]')).toBeVisible();
  const source = (await mainHeader.boundingBox())!;
  await expect(mainHeader).toHaveCSS("cursor", "grab");
  await page.mouse.move(source.x + 3, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + 23, source.y + source.height / 2, { steps: 4 });
  await expect(page.locator("[data-workbench-panel-drag-shield]")).toHaveCSS("cursor", "grabbing");
  await expect(page.locator("[data-workbench-edge-drop][data-drop-active]")).toHaveCount(0);
  await page.mouse.up();
  await page.reload();
  for (const region of ["side", "secondary"] as const) {
    const panel = page.locator(`[data-workbench-panel="${region}"]:visible`);
    await expect(panel).toBeVisible();
    const header = page.getByLabel(region === "side" ? "Side panel header" : "Bottom panel header", { exact: true });
    await header.focus();
    await header.press("Shift+F10");
    await expect(page.getByRole("menuitem", { name: /^Move panel to / })).toHaveCount(1);
    await expect(
      page.getByRole("menuitem", { name: `Move panel to ${region === "side" ? "right" : "bottom"}`, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => {
        const moved = (await panel.boundingBox())!;
        const content = (await main.boundingBox())!;
        return region === "side" ? moved.x < content.x : moved.y < content.y;
      })
      .toBe(true);
  }
};
