import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

const largeTableStoryId = "patterns-editors-markdown-editor-tables--editable-large-table";
const difficultTableStoryId = "patterns-editors-markdown-editor-tables--difficult-table-syntax";
const commentsStoryId = "patterns-editors-markdown-editor-tables--hidden-preserved-comments";
const slashCommandsStoryId = "patterns-editors-markdown-editor-tables--slash-commands";
const tallImageStoryId = "patterns-editors-markdown-editor-tables--tall-image-editing";

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
