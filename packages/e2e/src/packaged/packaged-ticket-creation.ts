import { expect, type Page } from "@playwright/test";

/** Exercise the compiled create form, its retained draft, and its activation choice. */
export const verifyTicketCreation = async (page: Page) => {
  const create = page.getByRole("button", { name: "Create row", exact: true }).first();
  await create.click();
  const dialog = page.getByRole("dialog");
  const editor = dialog.getByRole("textbox").first();
  await editor.fill("Packaged creation draft");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "retained-draft.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Packaged attachment"),
  });
  await page.mouse.click(1, 1);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await create.click();
  await expect(editor).toHaveText("Packaged creation draft");
  await expect(dialog.getByText("retained-draft.txt", { exact: true })).toBeVisible();
  const boardUrl = page.url();
  const upload = page.waitForResponse(
    (response) => response.request().method() === "POST" && /\/extensions\/[^/]+\/files\?/.test(response.url()),
  );
  await dialog.getByRole("button", { name: "Create without opening", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Create without opening", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Create without opening", exact: true })
    .filter({ hasText: "Create without opening" })
    .click();
  await expect(dialog).toBeHidden();
  expect((await upload).ok()).toBe(true);
  await expect(page.getByTestId("renderer-card").filter({ hasText: "Packaged creation draft" })).toBeVisible();
  expect(page.url()).toBe(boardUrl);
  await create.click();
  await expect(editor).toHaveText("");
  await expect(
    dialog
      .getByRole("button", { name: "Create without opening", exact: true })
      .filter({ hasText: "Create without opening" }),
  ).toBeVisible();
  await editor.fill("Discard this draft");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();
  await create.click();
  await expect(editor).toHaveText("");
  await page.keyboard.press("Escape");
};
