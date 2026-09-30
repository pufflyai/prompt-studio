import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl } from "./mermaid-renderer-storybook";

const storyId = "patterns-editors-markdown-editor-tables--slash-commands";

test.describe("markdown image slash command", () => {
  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(storyId));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  test("inserts images selected with the keyboard and preserves nearby content", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, storyId));
    await page.locator("[contenteditable='true']").click();
    await page.keyboard.type("Before the images");
    await page.keyboard.press("Enter");

    const markdown = page.locator("textarea[readonly]");
    for (const alt of ["First", "Second", "Third"]) {
      await page.keyboard.type("/image");
      await expect(page.getByRole("option", { name: "Image", exact: true })).toBeVisible();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Insert image" });
      await dialog.getByRole("textbox", { name: "Image URL" }).fill("https://example.com/diagram.png");
      await dialog.getByRole("textbox", { name: "Alt text" }).fill(alt);
      await dialog.getByRole("button", { name: "Insert image" }).click();
      await expect(dialog).toBeHidden();
      await expect(markdown).toHaveValue(new RegExp(`!\\[${alt}\\]`));
      await expect(page.locator(`img[alt='${alt}']`)).toBeAttached();
    }

    await page.keyboard.type("After the images");
    await expect(markdown).toHaveValue(
      /^Before the images\n\n!\[First\].*\n\n!\[Second\].*\n\n!\[Third\].*\n\nAfter the images$/,
    );
  });

  test("cancels image insertion and accepts another keyboard command", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, storyId));
    await page.locator("[contenteditable='true']").click();
    await page.keyboard.type("Keep this paragraph");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/image");
    await expect(page.getByRole("option", { name: "Image", exact: true })).toBeVisible();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Insert image" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("textarea[readonly]")).toHaveValue("Keep this paragraph");

    await page.keyboard.type("/image");
    await expect(page.getByRole("option", { name: "Image", exact: true })).toBeVisible();
    await page.keyboard.press("Enter");
    await dialog.getByRole("textbox", { name: "Image URL" }).fill("https://example.com/diagram.png");
    await dialog.getByRole("textbox", { name: "Alt text" }).fill("Diagram");
    await dialog.getByRole("button", { name: "Insert image" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("textarea[readonly]")).toHaveValue(/^Keep this paragraph\n\n!\[Diagram\]/);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator("textarea[readonly]")).toHaveValue("Keep this paragraph");
  });

  test("preserves text after the image command in the same paragraph", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, storyId));
    await page.locator("[contenteditable='true']").click();
    await page.keyboard.type("Tail");
    for (let index = 0; index < 4; index++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.type("/image");
    await expect(page.getByRole("option", { name: "Image", exact: true })).toBeVisible();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Insert image" });
    await dialog.getByRole("textbox", { name: "Image URL" }).fill("https://example.com/diagram.png");
    await dialog.getByRole("textbox", { name: "Alt text" }).fill("Diagram");
    await dialog.getByRole("button", { name: "Insert image" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("textarea[readonly]")).toHaveValue("![Diagram](https://example.com/diagram.png)Tail");
  });

  test("treats a slash after formatted content as paragraph text", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, storyId));
    const editor = page.locator("[contenteditable='true']");
    await editor.click();
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type("Keep this text");
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type("/image");
    await expect(page.locator("textarea[readonly]")).toHaveValue("**Keep this text**/image");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Next paragraph");
    await expect(page.locator("textarea[readonly]")).toHaveValue("**Keep this text**/image\n\nNext paragraph");
  });
});
