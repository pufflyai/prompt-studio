import { expect, type Frame, type Page } from "@playwright/test";

export const checkGroupedFolders = async (page: Frame, browserPage: Page) => {
  const item = page.locator('[data-canvas-item="ui-overlays-folderpickerdialog--folders"]');
  const preview = item.frameLocator("iframe");
  await preview.getByRole("button", { name: "New folder", exact: true }).click();
  await preview.getByRole("textbox", { name: "New folder name" }).fill("canvas-interactive");
  await item.getByRole("button", { name: "Theme for" }).click();
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
  await expect(preview.getByRole("textbox", { name: "New folder name" })).toHaveValue("canvas-interactive");
  await expect(item.locator("iframe")).toHaveAttribute("data-frame-ready", "true");
  await expect.poll(() => preview.locator("html").evaluate((element) => element.classList.contains("dark"))).toBe(true);
  await preview.getByRole("button", { name: "Create folder", exact: true }).click();
  await expect(preview.getByRole("option", { name: "canvas-interactive" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const viewport = page.locator("[data-canvas-viewport]");
  await viewport.press("0");
  const stage = page.locator("[data-canvas-stage]").first();
  await expect.poll(() => stage.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a)).toBe(1);
  await preview.getByRole("textbox", { name: "Folder path" }).hover();
  await browserPage.keyboard.down("Control");
  await browserPage.mouse.wheel(0, -100);
  await browserPage.keyboard.up("Control");
  await expect
    .poll(() => stage.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a))
    .toBeGreaterThan(1.3);
  const zoom = await stage.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
  await viewport.press("0");
  await expect.poll(() => stage.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a)).toBe(1);
  const empty = await viewport.boundingBox();
  await browserPage.mouse.move(empty!.x + 8, empty!.y + 8);
  const before = await stage.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { x: matrix.e, y: matrix.f, zoom: matrix.a };
  });
  await browserPage.keyboard.down("Control");
  await browserPage.mouse.wheel(0, -100);
  await browserPage.keyboard.up("Control");
  await expect
    .poll(() => stage.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a))
    .toBeGreaterThan(1.3);
  const after = await stage.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { x: matrix.e, y: matrix.f, zoom: matrix.a };
  });
  expect(after.x + ((8 - before.x) / before.zoom) * after.zoom).toBeCloseTo(8, 2);
  expect(after.y + ((8 - before.y) / before.zoom) * after.zoom).toBeCloseTo(8, 2);
  await viewport.press("0");
  const button = preview.getByRole("button", { name: "New folder", exact: true });
  await button.hover();
  const location = await button.boundingBox();
  await browserPage.mouse.down({ button: "middle" });
  await browserPage.mouse.move(location!.x + location!.width / 2 + 70, location!.y + location!.height / 2 + 20, {
    steps: 3,
  });
  await browserPage.mouse.up({ button: "middle" });
  await expect(preview.getByRole("textbox", { name: "New folder name" })).toHaveCount(0);
  await preview.getByRole("button", { name: "Open folder", exact: true }).click();
  await expect(preview.getByRole("status")).toContainText("Example closed");
  await item.getByRole("button", { name: "Reset frame", exact: true }).click();
  await expect(preview.getByRole("dialog")).toBeVisible();
  await expect(preview.getByRole("option", { name: "canvas-interactive" })).toHaveCount(0);
  await expect.poll(() => preview.locator("html").evaluate((element) => element.classList.contains("dark"))).toBe(true);
  await item.getByRole("button", { name: "Variant for" }).click();
  await page.getByRole("menuitem", { name: "Empty", exact: true }).click();
  await expect(item.locator("iframe")).toHaveAttribute("data-frame-story", "ui-overlays-folderpickerdialog--empty");
  await expect(item.locator("iframe")).toHaveAttribute("data-frame-ready", "true");
  await expect(preview.getByRole("option", { name: "canvas-interactive" })).toHaveCount(0);
  await expect.poll(() => preview.locator("html").evaluate((element) => element.classList.contains("dark"))).toBe(true);
  await item.getByRole("button", { name: "Variant for" }).click();
  await page.getByRole("menuitem", { name: "Folders", exact: true }).click();
  await expect(item.locator("iframe")).toHaveAttribute("data-frame-story", "ui-overlays-folderpickerdialog--folders");
  await expect(item.locator("iframe")).toHaveAttribute("data-frame-ready", "true");
  expect(await preview.getByRole("option").count()).toBeGreaterThan(0);
  return {
    frames: await page.locator("[data-canvas-stage] > [data-canvas-item]").count(),
    folderCreated: true,
    variantFixtureIsolated: true,
    variantRetainedTheme: true,
    themeRetainedDraft: true,
    zoomFactorFor100Pixels: zoom,
    emptyCanvasZoomFactor: after.zoom,
    zoomAnchored: true,
    middleDragPreservedControls: true,
    resetRestoresFixtureAndKeepsTheme: true,
  };
};

export const checkGroupedAutoBuild = async (page: Frame) => {
  const first = page.locator(
    '[data-canvas-item="dashboard-extensions-planner-auto-build-form--supervisor-and-eligible-tickets"]',
  );
  await expect(first.frameLocator("iframe").getByRole("dialog")).toBeVisible();
  const editor = first.frameLocator("iframe").locator('[contenteditable="true"]').first();
  await editor.fill("Build the interactive Canvas examples.");
  await first.getByRole("button", { name: "Theme for" }).click();
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const form = first.frameLocator("iframe");
  await expect(form.getByRole("dialog")).toBeVisible();
  await expect(editor).toContainText("Build the interactive Canvas examples.");
  const inputs = form.getByRole("textbox");
  expect(await inputs.count()).toBeGreaterThan(0);
  return {
    frames: await page.locator("[data-canvas-stage] > [data-canvas-item]").count(),
    containedDialog: true,
    editedPromptRetained: true,
    textInputs: await inputs.count(),
  };
};

export const checkCanvasInteractions = async (page: Frame, browserPage: Page, canvas: { id: string; name: string }) => {
  if (canvas.name === "Create folder") return checkGroupedFolders(page, browserPage);
  if (canvas.name === "Auto Build") return checkGroupedAutoBuild(page);
};
