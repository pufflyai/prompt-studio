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
  await verifyNearbyTabTargets(page);
};

const verifyNearbyTabTargets = async (page: Page) => {
  const nav = page.locator('[data-workbench-panel-drag="sidenav"]');
  await nav.focus();
  await nav.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Move panel to right", exact: true }).click();
  const navToggle = page.getByRole("button", { name: /^(Show|Hide) Sidenav$/ });
  await expect(navToggle.locator(".chakra-icon")).toHaveCSS("transform", "matrix(-1, 0, 0, 1, 0, 0)");
  await navToggle.click();
  await expect(navToggle).toHaveAccessibleName("Show Sidenav");
  await page.reload();
  await expect(navToggle).toHaveAccessibleName("Show Sidenav");
  await expect(navToggle.locator(".chakra-icon")).toHaveCSS("transform", "matrix(-1, 0, 0, 1, 0, 0)");
  await page.getByRole("button", { name: "Hide Side Panel", exact: true }).click();
  await page.getByRole("button", { name: "Hide Bottom Panel", exact: true }).click();
  await expect(page.locator('[data-workbench-panel="side"]:visible')).toHaveCount(0);
  await expect(page.locator('[data-workbench-panel="secondary"]:visible')).toHaveCount(0);
  const main = page.locator('[data-workbench-panel="main"]');
  await expect(page.getByLabel("Main panel header", { exact: true })).not.toHaveAttribute("data-panel-draggable");
  const bounds = (await main.boundingBox())!;
  const tab = main.getByRole("tab", { name: "Start", exact: true });
  const source = (await tab.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, { steps: 3 });
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 6 });
  await expect(page.locator("[data-workbench-edge-drop]")).toHaveCount(0);
  await expect.poll(() => main.boundingBox()).toEqual(bounds);
  for (const [region, position] of [
    ["side", "left"],
    ["side", "right"],
    ["secondary", "top"],
    ["secondary", "bottom"],
  ]) {
    await page.locator(`[data-workbench-edge-hit="${region}"][data-workbench-edge-position="${position}"]`).hover();
    await expect(page.locator(`[data-workbench-edge-drop="${region}"]`)).toBeVisible();
    await expect(page.locator(`[data-workbench-edge-drop="${region}"]`)).toHaveAttribute(
      "data-workbench-edge-position",
      position,
    );
    await expect(page.locator("[data-workbench-edge-drop], [data-workbench-tab-drop][data-drop-active]")).toHaveCount(
      1,
    );
    const slot = (await page.locator(`[data-workbench-edge-drop="${region}"]`).boundingBox())!;
    await expect
      .poll(() => main.boundingBox())
      .toEqual({
        x: bounds.x + (position === "left" ? slot.width : 0),
        y: bounds.y + (position === "top" ? slot.height : 0),
        width: bounds.width - (region === "side" ? slot.width : 0),
        height: bounds.height - (region === "secondary" ? slot.height : 0),
      });
  }
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator("[data-workbench-edge-drop]")).toHaveCount(0);
  await expect.poll(() => main.boundingBox()).toEqual(bounds);
  for (const [sourceRegion, region, position] of [
    ["main", "side", "right"],
    ["side", "secondary", "bottom"],
  ]) {
    const sourceTab = page.locator(`[data-workbench-panel="${sourceRegion}"]:visible`).getByRole("tab", {
      name: "Start",
      exact: true,
    });
    await sourceTab.hover();
    const sourceBounds = (await sourceTab.boundingBox())!;
    await page.mouse.move(sourceBounds.x + sourceBounds.width / 2, sourceBounds.y + sourceBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBounds.x + sourceBounds.width / 2 + 12, sourceBounds.y + sourceBounds.height / 2, {
      steps: 3,
    });
    await page.locator(`[data-workbench-edge-hit="${region}"][data-workbench-edge-position="${position}"]`).hover();
    await page.mouse.up();
    const moved = page.locator(`[data-workbench-panel="${region}"]:visible`);
    await expect(moved.getByRole("tab", { name: "Start", exact: true })).toBeVisible();
    await expect
      .poll(async () => {
        const panel = (await moved.boundingBox())!;
        const content = (await main.boundingBox())!;
        return region === "side" ? panel.x > content.x : panel.y > content.y;
      })
      .toBe(true);
    await verifyLastTabPanelMove(page, region, region === "side" ? "left" : "top");
  }
  await page.reload();
  const bottom = page.locator('[data-workbench-panel="secondary"]:visible');
  await expect(bottom.getByRole("tab", { name: "Start", exact: true })).toBeVisible();
  await expect.poll(async () => (await bottom.boundingBox())!.y < (await main.boundingBox())!.y).toBe(true);
};

const verifyLastTabPanelMove = async (page: Page, region: string, position: string) => {
  const panel = page.locator(`[data-workbench-panel="${region}"]:visible`);
  const tab = panel.getByRole("tab", { name: "Start", exact: true });
  // Earlier checks leave a session in Bottom. Close it through its tab menu
  // only after the existing destination-content checks have completed.
  const others = panel.getByRole("tab").filter({ hasNotText: "Start" });
  for (let remaining = await others.count(); remaining > 0; remaining--) {
    await others.first().focus();
    await page.keyboard.press("Shift+F10");
    await page.getByRole("menuitem", { name: "Close tab", exact: true }).click();
    await expect(others).toHaveCount(remaining - 1);
  }
  await expect(panel.getByRole("tab")).toHaveCount(1);
  const main = page.locator('[data-workbench-panel="main"]');
  await main.hover();
  await tab.hover();
  const before = (await panel.boundingBox())!;
  const bounds = (await main.boundingBox())!;
  const hit = page.locator(`[data-workbench-edge-hit="${region}"]`);
  for (const cancel of [true, false]) {
    await tab.hover();
    const source = (await tab.boundingBox())!;
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, { steps: 3 });
    await expect(hit).toHaveCount(1);
    await expect(hit).toHaveAttribute("data-workbench-edge-position", position);
    await hit.hover();
    await expect(page.locator("[data-workbench-edge-drop], [data-workbench-tab-drop][data-drop-active]")).toHaveCount(
      1,
    );
    const slot = (await page.locator(`[data-workbench-edge-drop="${region}"]`).boundingBox())!;
    await expect
      .poll(() => main.boundingBox())
      .toEqual({
        x: bounds.x + (position === "left" ? slot.width : 0),
        y: bounds.y + (position === "top" ? slot.height : 0),
        width: bounds.width - (region === "side" ? slot.width : 0),
        height: bounds.height - (region === "secondary" ? slot.height : 0),
      });
    if (cancel) await page.keyboard.press("Escape");
    await page.mouse.up();
    if (cancel) await expect.poll(() => panel.boundingBox()).toEqual(before);
  }
  await expect(tab).toBeVisible();
  const axis = region === "side" ? "x" : "y";
  await expect.poll(async () => (await panel.boundingBox())![axis] < (await main.boundingBox())![axis]).toBe(true);
};
