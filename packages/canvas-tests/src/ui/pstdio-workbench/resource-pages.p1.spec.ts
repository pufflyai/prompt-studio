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
  const properties = preview.getByText("Properties for A", { exact: true });
  if (!(await properties.isVisible()))
    await header.getByRole("button", { name: "Open Main right menu", exact: true }).click();
  await expect(properties).toBeVisible();
  await header.getByRole("button", { name: /^(Open|Close) Main right menu$/ }).click();
  await expect(properties).toBeHidden();

  const breadcrumb = header.locator("[data-workbench-page-drag-handle]");
  await expect(breadcrumb).toHaveCSS("cursor", "grab");
  const source = (await breadcrumb.boundingBox())!;
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
  await preview.getByRole("button", { name: "Open tabbed page", exact: true }).click();
  await expect(header.getByRole("tab", { name: /Companion/ })).toBeVisible();
  const wholeHeader = side.locator('[data-workbench-panel-header="side"]');
  const point = await wholeHeader.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    for (let x = rect.right - 4; x > rect.left; x -= 4) {
      const target = element.ownerDocument.elementFromPoint(x, y);
      if (target && !target.closest('button,a,[role="tab"],[role="button"]'))
        return { x: (x - rect.left) / rect.width, y: (y - rect.top) / rect.height };
    }
    throw new Error("Panel header has no draggable space");
  });
  const bounds = (await wholeHeader.boundingBox())!;
  const grab = { x: bounds.x + bounds.width * point.x, y: bounds.y + bounds.height * point.y };
  const tabbedHeader = (await header.boundingBox())!;
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x, grab.y + 10, { steps: 3 });
  await page.mouse.move(tabbedHeader.x + tabbedHeader.width / 2, tabbedHeader.y + tabbedHeader.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(header.getByRole("tab")).toHaveCount(1);
  await expect(side.getByRole("tab")).toHaveCount(2);
});

// Critical: opening a resource must retain its receiving tab container and live native state.
test("ordinary resource opens stay in the current tabbed page and Home has no tabs", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/workbench/resource-pages.canvas.tsx#Interactive",
  );
  const main = preview.locator('[data-workbench-panel="main"]');
  const side = preview.locator('[data-workbench-panel="side"]');
  const header = main.locator('[data-workbench-panel-header="main"]');
  const editor = main.locator('[data-resource-editor="A"]');
  await editor.getByRole("textbox").fill("Keep this native draft");
  const mount = await editor.getAttribute("data-editor-mount");
  await header.focus();
  await header.press("Shift+F10");
  await preview.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
  await expect(side.getByRole("textbox", { name: "Draft for A" })).toHaveValue("Keep this native draft");
  await preview.getByRole("button", { name: "Open tabbed page", exact: true }).click();
  await expect(header.getByRole("tab", { name: /Companion/ })).toBeVisible();
  await preview.getByRole("button", { name: "Open A in Main", exact: true }).click();
  await expect(header.getByRole("tab")).toHaveCount(2);
  await expect(main.getByRole("textbox", { name: "Draft for A" })).toHaveValue("Keep this native draft");
  await expect(main.locator('[data-resource-editor="A"]')).toHaveAttribute("data-editor-mount", mount!);
  await expect(side.getByRole("tab", { name: /Resource A/ })).toHaveCount(0);
  await preview.getByRole("button", { name: "Open B in Main", exact: true }).click();
  await expect(header.getByRole("tab")).toHaveCount(3);
  await expect(main.getByRole("textbox", { name: "Draft for B" })).toBeVisible();
  await header.getByRole("tab", { name: /Companion/ }).click();
  await header.getByRole("tab", { name: /Resource A/ }).click();
  await expect(main.getByRole("textbox", { name: "Draft for A" })).toHaveValue("Keep this native draft");
  await expect(header.getByRole("tab")).toHaveCount(3);
  await preview.getByRole("button", { name: "Open Home", exact: true }).click();
  await expect(header.getByRole("tab")).toHaveCount(0);
  await expect(header.locator("[data-workbench-page-drag-handle]")).toHaveText("Home");
});

// Critical: moving the default page must clear navigation and retain the receiving Main's tab behavior.
test("moving Home clears its navigation selection and New record then opens in a tab", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/workbench/resource-pages.canvas.tsx#Interactive",
  );
  const main = preview.locator('[data-workbench-panel="main"]');
  const side = preview.locator('[data-workbench-panel="side"]');
  const header = main.locator('[data-workbench-panel-header="main"]');
  const home = preview.locator('[data-workbench-region="sidenav"]').getByRole("option", { name: "Home", exact: true });
  await home.click();
  await expect(home).toHaveAttribute("aria-selected", "true");
  const source = (await header.locator("[data-workbench-page-drag-handle]").boundingBox())!;
  const target = (await side.getByRole("tab", { name: /Companion/ }).boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2 + 10, { steps: 3 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(side.getByRole("tab", { name: "Home", exact: true })).toBeVisible();
  await expect(home).not.toHaveAttribute("aria-selected", "true");
  await header.focus();
  await page.keyboard.press("Alt+Shift+N");
  await expect(header.getByRole("tab", { name: "Resource Created 1", exact: true })).toBeVisible();
  await expect(main.getByRole("textbox", { name: "Draft for Created 1" })).toBeVisible();
  await expect(home).not.toHaveAttribute("aria-selected", "true");
});

// Critical: dragging Main must not reveal closed auxiliary destinations.
test("Main dragging cannot create a closed auxiliary panel", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/workbench/resource-pages.canvas.tsx#Interactive",
  );
  const main = preview.locator('[data-workbench-panel="main"]');
  const header = main.locator('[data-workbench-panel-header="main"]');
  await preview.getByRole("button", { name: "Toggle Side", exact: true }).click();
  await expect(header).not.toHaveAttribute("data-panel-draggable", "true");
  const source = (await header.locator("[data-workbench-page-drag-handle]").boundingBox())!;
  const target = (await main.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2 + 10, { steps: 3 });
  await expect(preview.locator('[data-workbench-edge-hit="secondary"]')).toHaveCount(0);
  await expect(preview.locator('[data-workbench-edge-hit="side"]')).toHaveCount(0);
  await page.mouse.move(target.x + target.width - 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(main.getByRole("textbox", { name: "Draft for A" })).toBeVisible();
  await expect(preview.locator('[data-workbench-panel="side"]:visible')).toHaveCount(0);
  await preview.getByRole("button", { name: "Toggle Side", exact: true }).click();
  await expect(header).toHaveAttribute("data-panel-draggable", "true");
});

// Critical: resource references must leave the source editor and its input visible.
test("resource links preview unpinned in Side while ordinary opens still use Main", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/workbench/resource-pages.canvas.tsx#Interactive",
  );
  const main = preview.locator('[data-workbench-panel="main"]');
  const side = preview.locator('[data-workbench-panel="side"]');
  const draft = main.getByRole("textbox", { name: "Draft for A" });
  await draft.fill("Keep the source");
  await preview.getByRole("button", { name: "Open B link", exact: true }).click();
  await expect(side.getByRole("tab", { name: "Resource B", exact: true })).toBeVisible();
  await expect(side.getByRole("textbox", { name: "Draft for B" })).toBeVisible();
  await expect(draft).toHaveValue("Keep the source");
  await expect(main.getByRole("tab")).toHaveCount(0);
  await preview.getByRole("button", { name: "Open B in Main", exact: true }).click();
  await expect(main.getByRole("textbox", { name: "Draft for B" })).toBeVisible();
  await expect(side.getByRole("tab", { name: "Resource B", exact: true })).toHaveCount(0);
});
