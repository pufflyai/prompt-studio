import { expect, type Page } from "@playwright/test";

export const verifySessionTools = async (page: Page) => {
  const main = page.locator('[data-workbench-panel="main"]');
  const tools = main.getByRole("group", { name: "Available tabs" });
  const newSession = tools.getByRole("button", { name: "New session", exact: true });
  await expect(newSession).toBeVisible();
  await expect(main.getByRole("tab")).toHaveCount(0);
  await newSession.click();
  await expect(main.getByRole("tab", { name: "New session", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/sessions\/new\?/);
  const editor = main.getByTestId("content-editable").filter({ visible: true });
  await expect(editor).toBeVisible();
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await expect(main.getByRole("tab", { name: "New session", exact: true })).toBeVisible();
  const created = page.waitForResponse(
    (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/v1/sessions",
  );
  await editor.fill("Start from a New session tab");
  await main.getByTestId("send-message-button").filter({ visible: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const session = (await response.json()) as { id: string };
  await expect(page).toHaveURL(new RegExp(`/session\\?.*${session.id}`));
  await expect(main.getByRole("tab")).toHaveCount(1);
  await expect(main.getByRole("tab", { selected: true })).toContainText("Start from a New session tab");
  const tabIds = () =>
    main
      .locator("[data-workbench-tab]")
      .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("data-workbench-tab")));
  const beforeTerminal = await tabIds();
  await main.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "Terminal", exact: true }).click();
  await expect(main.locator("[data-workbench-tab]")).toHaveCount(beforeTerminal.length + 1);
  const terminalId = (await tabIds()).find((id) => !beforeTerminal.includes(id));
  expect(terminalId).toBeTruthy();
  const terminal = main.locator(`[data-workbench-tab="${terminalId}"]`).getByRole("tab");
  await expect(terminal).toBeVisible();
  await expect(main.getByRole("textbox", { name: "Terminal input", exact: true })).toBeVisible();
  const ids = await tabIds();
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await expect(main.getByRole("tab")).toHaveCount(2);
  expect(await tabIds()).toEqual(ids);
  await page.reload();
  await expect(main.getByRole("tab")).toHaveCount(2);
  await terminal.click({ button: "right" });
  await page
    .locator('[role="menu"][data-state="open"]')
    .getByRole("menuitem", { name: "Close tab", exact: true })
    .click();
  await expect(terminal).toHaveCount(0);
  await main.getByRole("tab", { selected: true }).click({ button: "right" });
  await page
    .locator('[role="menu"][data-state="open"]')
    .getByRole("menuitem", { name: "Close tab", exact: true })
    .click();
  await expect(newSession).toBeVisible();
  await main.getByRole("button", { name: "Add panel", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Add panel", exact: true });
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  await expect(menu.getByRole("menuitem", { name: "Terminal", exact: true })).toBeVisible();
  await menu.getByRole("menuitem", { name: "New session", exact: true }).click();
  await expect(main.getByRole("tab", { name: "New session", exact: true })).toBeVisible();
  await expect(editor).toBeVisible();
};
