import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

const largeTableStoryId = "patterns-editors-markdown-editor-tables--editable-large-table";
const difficultTableStoryId = "patterns-editors-markdown-editor-tables--difficult-table-syntax";
const commentsStoryId = "patterns-editors-markdown-editor-tables--hidden-preserved-comments";
const slashCommandsStoryId = "patterns-editors-markdown-editor-tables--slash-commands";
const tallImageStoryId = "patterns-editors-markdown-editor-tables--tall-image-editing";
const editModeDataTableStoryId = "components-data-display-data-table--edit-mode";
const richTextEditModeDataTableStoryId = "components-data-display-data-table--rich-text-edit-mode";
const modeToggleDataTableStoryId = "components-data-display-data-table--mode-toggle";
const selectableEditModeDataTableStoryId = "components-data-display-data-table--editable-selectable-rows";
const viewsEditModeDataTableStoryId = "components-data-display-data-table--editable-with-views";

test.describe("markdown table editor storybook", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(largeTableStoryId));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  test("paginates the supplied large table without dropping rows", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, largeTableStoryId));
    await waitForStoryPlayback(page);

    const rows = page.locator("table:visible tbody tr[data-document-row]");
    await expect(rows).toHaveCount(30);
    await expect(page.getByText("44 rows")).toBeVisible();
    await expect(page.getByText("Page", { exact: true })).toBeVisible();
    await expect(page.getByText("of 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "New row" })).toHaveCount(0);

    const tableScrollArea = page.locator("[data-table-scroll-area]");
    const tableViewport = tableScrollArea.locator("[data-scope='scroll-area'][data-part='viewport']");
    expect(await tableViewport.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(
      1,
    );

    await page.getByRole("button", { name: "30" }).click();
    const pageSizeMenu = page.getByRole("menu");
    await expect(pageSizeMenu.getByText("50", { exact: true })).toBeVisible();
    await expect(pageSizeMenu.getByText("100", { exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Go to next page" }).click();

    await expect(page.getByRole("button", { name: "New row" })).toBeVisible();
    await expect(rows).toHaveCount(14);
    await expect(rows.last()).toContainText("Y2K outfits");
  });

  test("uses contextual table controls and keeps every change undoable", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, difficultTableStoryId));
    await waitForStoryPlayback(page);

    const emittedMarkdown = page.locator("textarea[readonly]");
    const rows = page.locator("table:visible tbody tr[data-document-row]");
    await expect(rows).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Add row" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add column" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete table" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: /Header/ })).toHaveCount(0);

    const firstHeader = page.locator("table:visible th[data-data-column='true']").first();
    await firstHeader.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: /Align/ })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Rename column" }).click();
    const headerEditor = page.getByRole("textbox", { name: "Rename column Name" });
    await headerEditor.fill("Display name");
    await page.getByRole("button", { name: "Cancel column rename" }).click();
    await expect(page.getByRole("columnheader", { name: "Name" }).first()).toBeVisible();

    await firstHeader.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rename column" }).click();
    await page.getByRole("textbox", { name: "Rename column Name" }).fill("Display name");
    await page.getByRole("button", { name: "Save column name" }).click();
    await expect(emittedMarkdown).toHaveValue(/Display name/);
    await page.keyboard.press("Control+z");
    await expect(emittedMarkdown).toHaveValue(/^\| Name\s+\|\s+Name/m);

    const firstEditableCell = rows.first().locator("td[data-editable='true']").first();
    await firstEditableCell.click();
    const cellEditor = page.locator("[data-table-cell-editor] [contenteditable='true']");
    await cellEditor.fill("Alice | Owner");
    await page.getByRole("button", { name: "Cancel cell edit" }).click();
    await expect(firstEditableCell).toContainText("Alice");

    await firstEditableCell.click();
    await page.locator("[data-table-cell-editor] [contenteditable='true']").fill("Alice | Owner");
    await page.getByRole("button", { name: "Save cell" }).click();
    await expect(emittedMarkdown).toHaveValue(/Alice \\?\| Owner/);
    await page.keyboard.press("Control+z");
    await expect(emittedMarkdown).toHaveValue(/\| Alice\s+\| Admin/);

    await page.getByRole("button", { name: "New row" }).click();
    await expect(rows).toHaveCount(3);
    await page.keyboard.press("Control+z");
    await expect(rows).toHaveCount(2);

    await page.getByRole("button", { name: "Insert column" }).click();
    await expect(page.getByRole("columnheader", { name: "Column 5" })).toBeVisible();
    await page.keyboard.press("Control+z");
    await expect(page.getByRole("columnheader", { name: "Column 5" })).toHaveCount(0);

    const codeHeader = page.getByRole("columnheader", { name: "Code" });
    await codeHeader.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete column" }).click();
    await expect(page.getByRole("columnheader", { name: "Code" })).toHaveCount(0);
    await page.keyboard.press("Control+z");
    await expect(page.getByRole("columnheader", { name: "Code" })).toBeVisible();

    await rows.last().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete row" }).click();
    await expect(rows).toHaveCount(1);
    await page.keyboard.press("Control+z");
    await expect(rows).toHaveCount(2);

    const tableNode = page.getByTestId("markdown-table-node");
    await tableNode.click({ position: { x: 2, y: 2 } });
    await expect(tableNode).toHaveAttribute("data-selected", "true");
    await page.keyboard.press("Delete");
    await expect(page.locator("table:visible")).toHaveCount(0);
    await page.keyboard.press("Control+z");
    await expect(page.locator("table:visible")).toHaveCount(1);
  });

  test("opens slash commands for tables, images, and other blocks", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, slashCommandsStoryId));

    const editor = page.locator("[contenteditable='true']");
    const emittedMarkdown = page.locator("textarea[readonly]");
    await expect(page.getByRole("button", { name: "Add table" })).toHaveCount(0);

    await editor.click();
    await page.keyboard.type("/");
    const commandMenu = page.getByRole("listbox", { name: "Insert content" });
    await expect(commandMenu).toBeVisible();
    await expect(commandMenu.getByRole("option", { name: /Table/ })).toBeVisible();
    await expect(commandMenu.getByRole("option", { name: /Image/ })).toBeVisible();
    await expect(commandMenu.getByRole("option", { name: /Code block/ })).toBeVisible();
    await expect(commandMenu.getByRole("option", { name: /Divider/ })).toBeVisible();
    await expect(commandMenu.getByText("Insert an editable table")).toHaveCount(0);
    await expect(commandMenu.getByText("Insert an image from a URL")).toHaveCount(0);

    await page.keyboard.type("table");
    await page.keyboard.press("Enter");
    await expect(page.locator("table:visible")).toHaveCount(1);
    await page.keyboard.press("Control+z");
    await expect(page.locator("table:visible")).toHaveCount(0);

    await page.goto(storyUrl(baseUrl, slashCommandsStoryId));
    await editor.click();
    await page.keyboard.type("/image");
    await expect(commandMenu.getByRole("option", { name: /Image/ })).toBeVisible();
    await page.keyboard.press("Enter");
    const imageDialog = page.getByRole("dialog", { name: "Insert image" });
    await imageDialog.getByRole("textbox", { name: "Image URL" }).fill("https://example.com/diagram.png");
    await imageDialog.getByRole("textbox", { name: "Alt text" }).fill("Diagram");
    await imageDialog.getByRole("button", { name: "Insert image" }).click();
    await expect(imageDialog).toBeHidden();
    await expect(emittedMarkdown).toHaveValue(/!\[Diagram\]\(https:\/\/example\.com\/diagram\.png\)/);
    await page.keyboard.press("Control+z");
    await expect(emittedMarkdown).not.toHaveValue(/Diagram/);
  });

  test("keeps the editor scroll position stable while typing below a tall inserted image", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, tallImageStoryId));

    const editor = page.locator("[contenteditable='true']");
    const editorViewport = page.locator("[data-scope='scroll-area'][data-part='viewport']").first();
    await editor.click();
    await page.keyboard.type("/");
    const commandMenu = page.getByRole("listbox", { name: "Insert content" });
    await expect(commandMenu).toBeVisible();
    await page.keyboard.type("image");
    const imageOption = commandMenu.getByRole("option", { name: "Image" });
    await expect(imageOption).toBeVisible();
    await imageOption.click();
    const imageDialog = page.getByRole("dialog", { name: "Insert image" });
    await imageDialog.getByRole("textbox", { name: "Image URL" }).fill("https://example.com/tall-image.png");
    await imageDialog.getByRole("textbox", { name: "Alt text" }).fill("Tall image");
    await imageDialog.getByRole("button", { name: "Insert image" }).click();
    const tallImage = page.locator("img[alt='Tall image']");
    await expect(tallImage).toBeAttached();
    await tallImage.evaluate((image) => {
      image.style.width = "320px";
      image.style.height = "1200px";
      image.dispatchEvent(new Event("load"));
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));

    const scrollTopBeforeTyping = await editorViewport.evaluate((element) => element.scrollTop);
    await page.keyboard.type("Text below the image");
    const scrollTopAfterTyping = await editorViewport.evaluate((element) => element.scrollTop);

    expect(scrollTopAfterTyping).toBe(scrollTopBeforeTyping);
  });

  test("keeps block insertion out of the text selection toolbar", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, slashCommandsStoryId));

    const editor = page.locator("[contenteditable='true']");
    await editor.click();
    await page.keyboard.type("Format this text");
    await page.keyboard.press("Control+a");

    await expect(page.getByRole("button", { name: "Bold" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Code Block" })).toHaveCount(0);
  });
});

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

  test("hides HTML comments while preserving their exact Markdown source", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, commentsStoryId));

    const editor = page.locator("[contenteditable='true']");
    await expect(editor).toContainText("Visible content before the comments.");
    await expect(editor).toContainText("Visible content after the comments.");
    await expect(editor).not.toContainText("fds:source-only:start");
    await expect(editor).not.toContainText("This source-only marker stays");

    const emittedMarkdown = page.locator("textarea[readonly]");
    await expect(emittedMarkdown).toHaveValue(/<!-- fds:source-only:start -->/);
    await expect(emittedMarkdown).toHaveValue(/<!-- fds:source-only:end -->/);
  });
});
