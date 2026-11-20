import { expect, type Page } from "@playwright/test";

export const verifyNotesPageIsolation = async (page: Page, tabbedUrl: string) => {
  const main = page.locator('[data-workbench-panel="main"]');
  const header = page.locator('[data-workbench-panel-header="main"]');
  const breadcrumbs = page.getByRole("navigation", { name: "breadcrumb" });
  const nav = page.locator('[data-workbench-region="sidenav"]');
  const notes = nav.getByRole("option", { name: "Notes", exact: true });
  const sideFirst = page
    .locator('[data-workbench-panel-header="side"]')
    .getByRole("tab", { name: "Isolation first", exact: true });
  const resourceActions = () => header.getByRole("button", { name: /^Actions for / });
  const editor = main.getByRole("textbox", { name: "", exact: true });
  const bodies = { first: "First note body", second: "Second note body" };
  const openNote = async (title: string) => {
    await header.focus();
    await page.keyboard.press("Alt+Shift+K");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await palette.getByRole("textbox").fill(title);
    const result = palette.getByRole("option").filter({ hasText: title });
    await expect(result).toBeVisible();
    await result.click();
    await expect(palette).toBeHidden();
  };
  const expectNote = async (title: string, body?: string) => {
    await expect(breadcrumbs).toContainText(title);
    await expect(editor).toBeVisible();
    if (body) await expect(editor).toContainText(body);
    await expect(header.getByRole("tab")).toHaveCount(0);
  };
  const expectNoteTab = async (title: string, body: string) => {
    await expect(page).toHaveURL(tabbedUrl);
    await expect(header.getByRole("tab", { name: title, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(editor).toContainText(body);
  };
  const renameSelected = async (title: string) => {
    await resourceActions().click();
    await page.getByRole("menuitem", { name: "Rename note", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill(title);
    await dialog.getByRole("button", { name: "Run", exact: true }).click();
    await expectNote(title);
  };
  await renameSelected("Isolation first");
  await editor.fill(bodies.first);
  await resourceActions().click();
  await page.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
  await expect(sideFirst).toBeVisible();
  // With no Home installed, the dedicated note falls back to its Notes ancestor.
  await expect(page).toHaveURL(/\/extensions\/pstdio\.notes\/notes$/);
  await expect(breadcrumbs).toContainText("Notes");
  await header.getByRole("button", { name: "Page actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "New note", exact: true }).click();
  const createDialog = page.getByRole("dialog", { name: "New note", exact: true });
  await createDialog.getByRole("textbox", { name: "Title", exact: true }).fill("Isolation second");
  const secondOpening = page.waitForResponse(
    (reply) =>
      new URL(reply.url()).pathname.endsWith("/text-editing/open") &&
      reply.request().postDataJSON()?.scope?.target?.resource?.label === "Isolation second",
  );
  await createDialog.getByRole("button", { name: "Run", exact: true }).click();
  await expectNote("Isolation second");
  const admitted = await (await secondOpening).json();
  expect(admitted.ok).toBe(true);
  expect(admitted.value.token).toBeTruthy();
  // The later full navigation must follow this note's acknowledged edit, not its local DOM update.
  const secondSaved = page.waitForResponse((reply) => {
    if (!new URL(reply.url()).pathname.endsWith("/text-editing/request")) return false;
    const input = reply.request().postDataJSON();
    return input.token === admitted.value.token && input.request?.operation === "submit";
  });
  await editor.fill(bodies.second);
  expect((await (await secondSaved).json()).ok).toBe(true);
  await expect(sideFirst).toBeVisible();
  await expect(notes).toHaveAttribute("aria-expanded", "true");
  await expect(notes.getByRole("button", { name: /^(Expand|Collapse) group$/ })).toHaveCount(0);
  await notes.click();
  await expect(notes).toHaveAttribute("aria-expanded", "false");
  await notes.click();
  await expect(notes).toHaveAttribute("aria-expanded", "true");
  await expectNote("Isolation second", bodies.second);
  await page.goto(tabbedUrl);
  await expect(header.getByRole("tab", { name: "Files", exact: true })).toBeVisible();
  await expect(header.getByRole("tab", { name: "Changes", exact: true })).toBeVisible();
  await expect(sideFirst).toBeVisible();
  const containerTabs = await main.getByRole("tab").allTextContents();
  await openNote("Isolation first");
  await expectNoteTab("Isolation first", bodies.first);
  await expect(header.getByRole("tab")).toHaveText([...containerTabs, "Isolation first"]);
  await expect(sideFirst).toHaveCount(0);
  await page.reload();
  await expectNoteTab("Isolation first", bodies.first);
  await page.goto(tabbedUrl);
  await expect(main.getByRole("tab")).toHaveText([...containerTabs, "Isolation first"]);
  await page.reload();
  await expect(main.getByRole("tab")).toHaveText([...containerTabs, "Isolation first"]);
  await openNote("Isolation second");
  await expectNoteTab("Isolation second", bodies.second);
  await openNote("Isolation first");
  await expectNoteTab("Isolation first", bodies.first);
  await expect(sideFirst).toHaveCount(0);
  await page.keyboard.press("Alt+Shift+K");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("textbox").fill(">New note");
  await palette.getByRole("option", { name: /New note/, selected: true }).click();
  await expectNoteTab("New note", "");
  await editor.fill("Created inside the tabbed Main");
  await expect(page).toHaveURL(tabbedUrl);
};
