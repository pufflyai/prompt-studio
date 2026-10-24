import { expect, type Page } from "@playwright/test";

export const verifySessionTools = async (page: Page) => {
  const main = page.locator('[data-workbench-panel="main"]');
  const editor = main.getByTestId("content-editable").filter({ visible: true });
  await expect(editor).toBeVisible();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("New session");
  await expect(main.getByRole("tab")).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Add panel", exact: true })).toHaveCount(0);
  const created = page.waitForResponse(
    (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/v1/sessions",
  );
  await editor.fill("Main session");
  await main.getByTestId("send-message-button").filter({ visible: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const session = (await response.json()) as { id: string };
  await expect(page).toHaveURL(new RegExp(`/session\\?.*${session.id}`));
  await expect(main.getByRole("tab")).toHaveCount(0);
  const mainUrl = page.url();

  const showSide = page.getByRole("button", { name: "Show Side Panel", exact: true });
  if (await showSide.isVisible()) await showSide.click();
  const side = page.locator('[data-workbench-panel="side"]');
  await side.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "New session", exact: true }).click();
  const draft = side.getByRole("tab", { name: "New session", exact: true });
  await expect(draft).toBeVisible();
  const sideCreated = page.waitForResponse(
    (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/v1/sessions",
  );
  await side.getByTestId("content-editable").filter({ visible: true }).fill("Side session");
  await side.getByTestId("send-message-button").filter({ visible: true }).click();
  expect((await sideCreated).status()).toBe(201);
  const sideSession = side.getByRole("tab", { name: /Side session/ });
  await expect(sideSession).toBeVisible();
  await expect(page).toHaveURL(mainUrl);
  await side.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "Terminal", exact: true }).click();
  const openedTerminal = side.getByRole("tab").filter({ hasText: "Terminal" });
  await expect(openedTerminal).toBeVisible();
  const terminalId = await openedTerminal.locator("..").getAttribute("data-workbench-tab");
  const terminal = side.locator(`[data-workbench-tab="${terminalId}"]`).getByRole("tab");
  const ids = await side
    .locator("[data-workbench-tab]")
    .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("data-workbench-tab")));
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await expect(page).toHaveURL(mainUrl);
  await expect(side.getByRole("tab")).toHaveCount(2);
  await page.reload();
  await expect(sideSession).toBeVisible();
  await expect(terminal).toBeVisible();
  expect(
    await side
      .locator("[data-workbench-tab]")
      .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("data-workbench-tab"))),
  ).toEqual(ids);
  for (const tab of [terminal, sideSession]) {
    await tab.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Close tab", exact: true }).click();
    await expect(tab).toHaveCount(0);
  }
  if (await showSide.isVisible()) await showSide.click();
  await expect(side.getByRole("group", { name: "Available tabs" })).toBeVisible();
  await side.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "New session", exact: true }).click();
  await expect(draft).toBeVisible();
  await expect(side.getByTestId("content-editable").filter({ visible: true })).toBeVisible();
};
