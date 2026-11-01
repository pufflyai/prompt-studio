import { expect, type Frame, type Page } from "@playwright/test";

export const checkGroupedFolders = async (page: Frame, browserPage: Page) => {
  const item = page.locator('[data-canvas-item="Folders"]');
  await item.getByRole("button", { name: "Select Folders", exact: true }).click();
  // The other examples keep loading; only this frame gates its controls.
  await expect(item.locator("iframe")).toHaveAttribute("data-frame-ready", "true");
  const preview = item.frameLocator("iframe");
  await preview.getByRole("button", { name: "New folder", exact: true }).click();
  await preview.getByRole("textbox", { name: "New folder name" }).fill("canvas-interactive");
  await item.getByRole("button", { name: "Theme for" }).click();
  await page.getByRole("menuitem", { name: "Prompt Dark", exact: true }).click();
  await expect(preview.getByRole("textbox", { name: "New folder name" })).toHaveValue("canvas-interactive");
  await expect(item.locator("iframe")).toHaveAttribute("data-frame-ready", "true");
  await expect.poll(() => preview.locator("html").evaluate((element) => element.classList.contains("dark"))).toBe(true);
  await preview.getByRole("button", { name: "Create folder", exact: true }).click();
  await expect(preview.getByRole("option", { name: "canvas-interactive" })).toBeVisible();
  // Each export is its own frame, so the Empty frame never sees the Folders frame's draft.
  const sibling = page.locator('[data-canvas-item="Empty"]');
  await sibling.getByRole("button", { name: "Select Empty", exact: true }).click();
  await expect(sibling.locator("iframe")).toHaveAttribute(
    "data-frame-story",
    "packages/ui/src/components/overlays/folder-picker-dialog.canvas.tsx#Empty",
  );
  await expect(sibling.locator("iframe")).toHaveAttribute("data-frame-ready", "true");
  await expect(sibling.frameLocator("iframe").getByRole("option", { name: "canvas-interactive" })).toHaveCount(0);
  await item.getByRole("button", { name: "Select Folders", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const viewport = page.locator("[data-canvas-viewport]");
  // Native focus/scrollIntoView offsets must be impossible, not corrected after hit testing.
  expect(
    await viewport.evaluate((element) => {
      element.scrollLeft = 25;
      element.scrollTop = 25;
      return { x: element.scrollLeft, y: element.scrollTop };
    }),
  ).toEqual({ x: 0, y: 0 });
  // Selecting an offscreen sibling must use the camera, never native element scrolling.
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBe(0);
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBe(0);
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
  await viewport.press("f");
  // Fit makes twelve sibling frames small; finish by keyboard after the pointer gestures.
  await preview.getByRole("button", { name: "Open folder", exact: true }).press("Enter");
  await expect(preview.getByRole("status")).toContainText("Example closed");
  await item.getByRole("button", { name: "Reset frame", exact: true }).click();
  await expect(preview.getByRole("dialog")).toBeVisible();
  await expect(preview.getByRole("option", { name: "canvas-interactive" })).toHaveCount(0);
  await expect.poll(() => preview.locator("html").evaluate((element) => element.classList.contains("dark"))).toBe(true);
  return {
    frames: await page.locator("[data-canvas-stage] > [data-canvas-item]").count(),
    folderCreated: true,
    siblingFrameIsolated: true,
    themeRetainedDraft: true,
    zoomFactorFor100Pixels: zoom,
    emptyCanvasZoomFactor: after.zoom,
    zoomAnchored: true,
    middleDragPreservedControls: true,
    resetRestoresFixtureAndKeepsTheme: true,
  };
};
