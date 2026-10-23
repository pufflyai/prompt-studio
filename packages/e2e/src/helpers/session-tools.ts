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
  await main.getByRole("tab", { selected: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Close tab", exact: true }).click();
  await expect(newSession).toBeVisible();
  await main.getByRole("button", { name: "Add panel", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Add panel", exact: true });
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  await expect(menu.getByRole("menuitem", { name: "Terminal", exact: true })).toBeVisible();
  await menu.getByRole("menuitem", { name: "New session", exact: true }).click();
  await expect(main.getByRole("tab", { name: "New session", exact: true })).toBeVisible();
  await expect(editor).toBeVisible();
};
