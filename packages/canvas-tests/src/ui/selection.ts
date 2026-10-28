import { expect, type Frame, type Page } from "@playwright/test";

export const checkFrameSelection = async (surface: Frame, page: Page) => {
  const form = surface.locator('[data-canvas-item="project-form"]');
  const controls = surface.locator('[data-canvas-item="controls"]');
  const document = form.frameLocator("iframe");
  const create = document.getByRole("button", { name: "Create project", exact: true, includeHidden: true });
  await expect(form).toHaveAttribute("data-canvas-selected", "false");
  await expect(controls).toHaveAttribute("data-canvas-selected", "false");
  const stage = surface.locator("[data-canvas-stage]").first();
  const camera = await stage.evaluate((element) => getComputedStyle(element).transform);
  const inactive = await create.boundingBox();
  await page.mouse.move(inactive!.x + inactive!.width / 2, inactive!.y + inactive!.height / 2);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(inactive!.x + inactive!.width / 2 + 50, inactive!.y + inactive!.height / 2 + 20, { steps: 3 });
  await page.mouse.up({ button: "middle" });
  await expect(form).toHaveAttribute("data-canvas-selected", "false");
  await expect.poll(() => stage.evaluate((element) => getComputedStyle(element).transform)).not.toBe(camera);
  await surface.locator("[data-canvas-viewport]").press("0");
  const target = await create.boundingBox();
  await page.mouse.click(target!.x + target!.width / 2, target!.y + target!.height / 2);
  await expect(form).toHaveAttribute("data-canvas-selected", "true");
  await expect(document.getByRole("status")).toHaveCount(0);
  await create.click();
  await expect(document.getByRole("status")).toContainText("Preview created:");
  await document.getByRole("textbox", { name: "Project name" }).fill("Retained selection draft");
  const frame = await form.locator("iframe").elementHandle();
  const originalDocument = await frame!.contentFrame();
  await form.getByRole("button", { name: "Theme for" }).click();
  await surface.getByRole("menuitem", { name: "Dark", exact: true }).click();
  await expect(document.locator("html")).toHaveClass(/dark/);
  await expect(controls.frameLocator("iframe").locator("html")).not.toHaveClass(/dark/);
  await expect(document.getByRole("textbox", { name: "Project name" })).toHaveValue("Retained selection draft");

  const handle = form.getByRole("button", { name: "Move Project form · default", exact: true });
  const dimensions = await handle.evaluate((element) => ({ width: element.clientWidth, height: element.clientHeight }));
  expect(dimensions.width).toBeGreaterThanOrEqual(32);
  expect(dimensions.height).toBeGreaterThanOrEqual(32);
  const outline = await form.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).toBe("solid");
  await controls.getByRole("button", { name: "Select Shared controls · interactive", exact: true }).click();
  await expect(form).toHaveAttribute("data-canvas-selected", "false");
  await expect(controls).toHaveAttribute("data-canvas-selected", "true");
  await form.getByRole("button", { name: "Select Project form · default", exact: true }).click();
  await expect(document.getByRole("textbox", { name: "Project name" })).toHaveValue("Retained selection draft");
  expect(await frame!.contentFrame()).toBe(originalDocument);
  const viewport = surface.locator("[data-canvas-viewport]");
  const bounds = await viewport.boundingBox();
  await page.mouse.click(bounds!.x + bounds!.width - 16, bounds!.y + bounds!.height - 16);
  await expect(form).toHaveAttribute("data-canvas-selected", "false");
  await expect(controls).toHaveAttribute("data-canvas-selected", "false");
  const before = await form.evaluate((element) => getComputedStyle(element).transform);
  await handle.hover();
  const grip = await handle.boundingBox();
  await page.mouse.down();
  await page.mouse.move(grip!.x + grip!.width / 2 + 40, grip!.y + grip!.height / 2 + 20, { steps: 3 });
  await page.mouse.up();
  await expect(form).toHaveAttribute("data-canvas-selected", "true");
  await expect.poll(() => form.evaluate((element) => getComputedStyle(element).transform)).not.toBe(before);
  await expect(document.getByRole("textbox", { name: "Project name" })).toHaveValue("Retained selection draft");
  await viewport.press("Escape");
  await expect(form).toHaveAttribute("data-canvas-selected", "false");
  await form.getByRole("button", { name: "Select Project form · default", exact: true }).press("Enter");
  await expect(form).toHaveAttribute("data-canvas-selected", "true");
  return {
    firstClickSelectsOnly: true,
    selectedControlsInteractive: true,
    singleSelection: true,
    draftRetained: true,
    documentRetained: true,
    emptySpaceClears: true,
    escapeClears: true,
    keyboardSelection: true,
    largerHandle: dimensions,
    handleDragSelectsAndMoves: true,
    inactiveMiddlePanDoesNotSelect: true,
  };
};
