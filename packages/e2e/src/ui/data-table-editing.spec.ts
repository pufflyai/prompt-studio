import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

const editModeDataTableStoryId = "components-data-display-data-table--edit-mode";
const richTextEditModeDataTableStoryId = "components-data-display-data-table--rich-text-edit-mode";
const modeToggleDataTableStoryId = "components-data-display-data-table--mode-toggle";
const selectableEditModeDataTableStoryId = "components-data-display-data-table--editable-selectable-rows";
const viewsEditModeDataTableStoryId = "components-data-display-data-table--editable-with-views";

test.describe("data table edit mode storybook", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(editModeDataTableStoryId));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  test("uses one bordered edit mode with configurable editable cells", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, editModeDataTableStoryId));
    await waitForStoryPlayback(page);

    const rows = page.locator("table:visible tbody tr[data-document-row]");
    await expect(rows).toHaveCount(3);
    await expect(page.getByText("Live emitted Markdown")).toHaveCount(0);

    const rowNumberCell = rows.first().locator("td[data-column-id='rowIndex']");
    const nameCell = rows.first().locator("td[data-column-id='name']");
    const statusCell = rows.first().locator("td[data-column-id='status']");
    const nameHeader = page.locator("th[data-column-id='name']");
    await expect(rowNumberCell).toHaveText("1");
    await expect(nameHeader.locator("svg")).toBeVisible();
    const headerBackground = await nameHeader.evaluate((element) => getComputedStyle(element).backgroundColor);
    const rowNumberBackground = await rowNumberCell.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(headerBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(rowNumberBackground).toBe(headerBackground);
    await expect(nameCell).toHaveCSS("border-right-width", "1px");
    await expect(nameCell).toHaveCSS("border-bottom-width", "1px");
    await expect(nameCell).toHaveAttribute("tabindex", "0");
    await expect(statusCell).not.toHaveAttribute("tabindex", "0");

    const rowHeight = (await rows.first().boundingBox())!.height;
    await nameCell.click();
    await expect(nameCell).toHaveAttribute("data-editing", "true");
    await expect(nameCell).toHaveCSS("padding", "0px");
    const cellEditor = page.getByRole("textbox", { name: "Edit cell" });
    await expect(nameCell.locator("input, textarea")).toHaveCount(0);
    await expect(cellEditor).toHaveAttribute("contenteditable", "true");
    await expect(cellEditor).toHaveCSS("border-top-width", "0px");
    await expect(cellEditor).toHaveCSS("border-radius", "0px");
    const editorPopover = page.locator("[data-table-cell-editor]");
    const editorFooter = editorPopover.locator("[data-table-cell-editor-footer]");
    await expect(editorFooter).toBeVisible();
    await expect(editorFooter.getByRole("button", { name: "Save cell" })).toBeVisible();
    await expect(editorFooter.getByRole("button", { name: "Cancel cell edit" })).toBeVisible();
    expect((await rows.first().boundingBox())!.height).toBe(rowHeight);
    await page.getByRole("button", { name: "Cancel cell edit" }).click();

    await page.getByRole("button", { name: "Insert column" }).click();
    await expect(page.getByRole("columnheader", { name: "Column 4" })).toBeVisible();

    await nameHeader.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: /Align/ })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Rename column" }).click();
    const headerEditor = page.getByRole("textbox", { name: "Rename column Name" });
    await expect(nameHeader).toHaveCSS("padding", "0px");
    await expect(nameHeader.locator("input, textarea")).toHaveCount(0);
    await expect(headerEditor).toHaveAttribute("contenteditable", "true");
    await expect(headerEditor).toHaveCSS("border-top-width", "0px");
    await headerEditor.fill("Person");
    await page.getByRole("button", { name: "Save column name" }).click();
    await expect(page.getByRole("columnheader", { name: "Person" })).toBeVisible();

    await page.getByRole("button", { name: "New row" }).click();
    await expect(rows).toHaveCount(4);
  });
});

test.describe("rich data table edit mode storybook", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(richTextEditModeDataTableStoryId));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  test("edits rich Markdown with a full-width Markdown editor inside the table cell", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, richTextEditModeDataTableStoryId));

    const firstRow = page.locator("table:visible tbody tr[data-document-row]").first();
    const summaryCell = firstRow.locator("td[data-column-id='summary']");
    await expect(summaryCell.locator("strong")).toHaveText("Bold content");
    await expect(summaryCell.locator("em")).toHaveText("emphasis");

    const rowHeight = (await firstRow.boundingBox())!.height;
    await summaryCell.click();
    const nestedEditor = page.getByTestId("content-editable");
    await expect(nestedEditor).toBeVisible();
    await expect(nestedEditor.locator("strong")).toHaveText("Bold content");
    const cellBox = await summaryCell.boundingBox();
    const editorPopover = page.locator("[data-table-cell-editor]");
    const editorBox = await editorPopover.boundingBox();
    expect(cellBox).not.toBeNull();
    expect(editorBox).not.toBeNull();
    expect(editorBox!.width).toBeGreaterThanOrEqual(cellBox!.width + 40);
    expect(Math.abs(editorBox!.y - cellBox!.y)).toBeLessThanOrEqual(2);
    const editorBody = editorPopover.locator("[data-table-cell-editor-body]");
    const editorFooter = editorPopover.locator("[data-table-cell-editor-footer]");
    const initialEditorBodyBox = await editorBody.boundingBox();
    const editorFooterBox = await editorFooter.boundingBox();
    expect(initialEditorBodyBox).not.toBeNull();
    expect(editorFooterBox).not.toBeNull();
    expect(initialEditorBodyBox!.height).toBeLessThan(100);
    expect(editorFooterBox!.y).toBeGreaterThanOrEqual(initialEditorBodyBox!.y + initialEditorBodyBox!.height - 1);
    await expect(editorFooter.getByRole("button", { name: "Save cell" })).toBeVisible();
    await expect(editorFooter.getByRole("button", { name: "Cancel cell edit" })).toBeVisible();
    expect((await firstRow.boundingBox())!.height).toBe(rowHeight);

    await nestedEditor.evaluate((element) => {
      const target = element.querySelector("strong")?.firstChild;
      if (!target) throw new Error("Expected bold text to select");
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
    });
    const textToolbar = page.locator(".floating-text-format-toolbar.active");
    await expect(textToolbar).toBeVisible();
    expect(await textToolbar.evaluate((element) => element.parentElement === document.body)).toBe(true);
    const toolbarZIndex = Number(await textToolbar.evaluate((element) => getComputedStyle(element).zIndex));
    const editorZIndex = Number(await editorPopover.evaluate((element) => getComputedStyle(element).zIndex));
    expect(toolbarZIndex).toBeGreaterThan(editorZIndex);
    await expect(textToolbar.getByRole("button", { name: "Heading 1" })).toBeVisible();
    await expect(textToolbar.getByRole("button", { name: "Heading 2" })).toBeVisible();
    await expect(textToolbar.getByRole("button", { name: "Heading 3" })).toBeVisible();
    await expect(textToolbar.getByRole("button", { name: "Heading 4" })).toHaveCount(0);
    await expect(textToolbar.getByRole("button", { name: "Heading 5" })).toHaveCount(0);
    await expect(textToolbar.getByRole("button", { name: "Heading 6" })).toHaveCount(0);
    await expect(textToolbar.getByRole("button", { name: "Strikethrough" })).toHaveCount(0);
    await expect(textToolbar.getByRole("button", { name: "Inline Code" }).locator(".lucide-code")).toBeVisible();
    await expect(textToolbar.getByRole("button", { name: "Code Block" })).toHaveCount(0);
    await expect(textToolbar.getByRole("button", { name: "Quote" }).locator(".lucide-text-quote")).toBeVisible();

    await nestedEditor.click();
    await page.keyboard.press("End");
    for (let line = 1; line <= 12; line += 1) {
      await page.keyboard.press("Enter");
      await page.keyboard.type(`Line ${line}`);
    }
    const expandedEditorBodyBox = await editorBody.boundingBox();
    expect(expandedEditorBodyBox).not.toBeNull();
    expect(expandedEditorBodyBox!.height).toBeGreaterThan(initialEditorBodyBox!.height);
    expect(expandedEditorBodyBox!.height).toBeLessThanOrEqual(194);
    await expect(
      editorBody.locator("[data-scope='scroll-area'][data-part='scrollbar'][data-orientation='vertical']"),
    ).toBeVisible();
    await expect(editorBody).not.toHaveCSS("overflow-y", "auto");
    await page.getByRole("button", { name: "Cancel cell edit" }).click();
    await expect(summaryCell.locator("strong")).toHaveText("Bold content");

    await summaryCell.click();
    await page.getByTestId("content-editable").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Updated");
    await page.getByRole("button", { name: "Save cell" }).click();
    await expect(summaryCell.locator("strong")).toHaveText("Bold content");
    await expect(summaryCell).toContainText("Updated");
  });

  test("preserves column geometry when toggling the same table into edit mode", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, modeToggleDataTableStoryId));

    const table = page.locator("table:visible");
    const dataHeaders = table.locator("th[data-data-column='true']");
    await expect(dataHeaders).toHaveCount(3);
    const rowIndexHeader = table.locator("th[data-column-id='rowIndex']");
    const rowIndexWidthInViewMode = (await rowIndexHeader.boundingBox())!.width;
    const widthsInViewMode = await dataHeaders.evaluateAll((headers) =>
      headers.map((header) => ({
        id: header.getAttribute("data-column-id"),
        width: header.getBoundingClientRect().width,
      })),
    );
    await expect(page.getByRole("button", { name: "Insert column" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New row" })).toHaveCount(0);

    await page.getByRole("button", { name: "Edit mode" }).click();

    await expect(dataHeaders).toHaveCount(3);
    const rowIndexWidthInEditMode = (await rowIndexHeader.boundingBox())!.width;
    const widthsInEditMode = await dataHeaders.evaluateAll((headers) =>
      headers.map((header) => ({
        id: header.getAttribute("data-column-id"),
        width: header.getBoundingClientRect().width,
      })),
    );
    expect(widthsInEditMode).toHaveLength(widthsInViewMode.length);
    for (const viewColumn of widthsInViewMode) {
      const editColumn = widthsInEditMode.find((column) => column.id === viewColumn.id);
      expect(editColumn).toBeDefined();
      expect(Math.abs(editColumn!.width - viewColumn.width)).toBeLessThanOrEqual(1);
    }
    expect(rowIndexWidthInViewMode).toBeGreaterThanOrEqual(35);
    expect(Math.abs(rowIndexWidthInEditMode - rowIndexWidthInViewMode)).toBeLessThanOrEqual(1);
    const widestColumn = Math.max(...widthsInEditMode.map((column) => column.width));
    const narrowestColumn = Math.min(...widthsInEditMode.map((column) => column.width));
    expect(widestColumn - narrowestColumn).toBeLessThanOrEqual(1);
    const insertColumnButton = page.getByRole("button", { name: "Insert column" });
    await expect(insertColumnButton).toBeVisible();
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect((await insertColumnButton.boundingBox())!.x).toBeLessThan(viewportWidth);
    await expect(page.getByRole("button", { name: "New row" })).toBeVisible();
  });

  test("combines editable cells with selectable rows", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, selectableEditModeDataTableStoryId));

    const rows = page.locator("table:visible tbody tr[data-document-row]");
    await expect(rows).toHaveCount(3);
    await rows.first().locator("td[data-column-id='rowSelection'] [data-part='control']").click();
    await expect(page.getByRole("toolbar", { name: "Selection actions" })).toContainText("1 rows selected");

    const editableCell = rows.first().locator("td[data-column-id='name']");
    await editableCell.click();
    await expect(page.getByRole("textbox", { name: "Edit cell" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel cell edit" }).click();
  });

  test("keeps saved views and filters available while the table is editable", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, viewsEditModeDataTableStoryId));

    const rows = page.locator("table:visible tbody tr[data-document-row]");
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Active" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add view" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Insert column" })).toBeVisible();
    await expect(rows).toHaveCount(3);

    await page.getByRole("tab", { name: "Active" }).click();
    await expect(rows).toHaveCount(2);
    await rows.first().locator("td[data-column-id='role']").click();
    await expect(page.getByRole("textbox", { name: "Edit cell" })).toBeVisible();
  });
});
