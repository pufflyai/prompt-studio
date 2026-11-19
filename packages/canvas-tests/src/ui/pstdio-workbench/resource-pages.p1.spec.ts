import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: page/tab movement must preserve native edits and keep Main navigation usable.
test("a resource page moves into tabs and reopening brings the same live editor to Main", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/workbench/resource-pages.canvas.tsx#Interactive",
  );
  const main = preview.locator('[data-workbench-panel="main"]');
  const side = preview.locator('[data-workbench-panel="side"]');
  const header = main.locator('[data-workbench-panel-header="main"]');
  await expect(header).toHaveCount(1);
  await expect(header.getByRole("tab")).toHaveCount(0);
  const editor = main.locator('[data-resource-editor="A"]');
  await editor.getByRole("textbox").fill("Keep this native draft");
  const mount = await editor.getAttribute("data-editor-mount");
  const properties = main.getByText("Properties for A", { exact: true });
  if (!(await properties.isVisible())) await header.getByRole("button", { name: /Properties/ }).click();
  await expect(properties).toBeVisible();
  await header.getByRole("button", { name: "Close Main right menu", exact: true }).click();
  await expect(properties).toBeHidden();

  const source = (await header.boundingBox())!;
  const target = (await side.getByRole("tab", { name: /Companion/ }).boundingBox())!;
  await page.mouse.move(source.x + source.width * 0.65, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width * 0.65, source.y + source.height / 2 + 10, { steps: 3 });
  await page.mouse.move(target.x + target.width * 0.75, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(side.getByRole("tab", { name: /Resource A/ })).toBeVisible();
  await expect(side.locator('[data-resource-editor="A"]')).toHaveAttribute("data-editor-mount", mount!);
  await expect(side.getByRole("textbox", { name: "Draft for A" })).toHaveValue("Keep this native draft");
  await expect(header.getByRole("tab")).toHaveCount(0);

  await preview.getByRole("button", { name: "Open A in Main", exact: true }).click();
  await expect(main.getByRole("textbox", { name: "Draft for A" })).toHaveValue("Keep this native draft");
  await expect(main.locator('[data-resource-editor="A"]')).toHaveAttribute("data-editor-mount", mount!);
  await expect(side.getByRole("tab", { name: /Resource A/ })).toHaveCount(0);
  await expect(header).toHaveCount(1);
  await expect(header.getByRole("tab")).toHaveCount(0);

  await header.focus();
  await header.press("Shift+F10");
  await preview.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
  await expect(side.getByRole("textbox", { name: "Draft for A" })).toHaveValue("Keep this native draft");
  await expect(side.locator('[data-resource-editor="A"]')).toHaveAttribute("data-editor-mount", mount!);
  const wholeHeader = side.locator('[data-workbench-panel-header="side"]');
  const grab = await wholeHeader.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    for (let x = rect.right - 4; x > rect.left; x -= 4) {
      const target = element.ownerDocument.elementFromPoint(x, y);
      if (target && !target.closest('button,a,[role="tab"],[role="button"]')) return { x, y };
    }
    throw new Error("Panel header has no draggable space");
  });
  const tabbedHeader = (await header.boundingBox())!;
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x, grab.y + 10, { steps: 3 });
  await page.mouse.move(tabbedHeader.x + tabbedHeader.width / 2, tabbedHeader.y + tabbedHeader.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(header.getByRole("tab")).toHaveCount(0);
  await expect(side.getByRole("tab")).toHaveCount(2);
});
