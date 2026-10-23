import { expect, type Page } from "@playwright/test";

export const verifySessionPlaceholder = async (page: Page) => {
  const main = page.locator('[data-workbench-panel="main"]');
  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb", exact: true });
  await expect(main.getByTestId("content-editable").filter({ visible: true })).toBeVisible();
  await expect(main.getByRole("tab")).toHaveCount(0);
  await expect(breadcrumb).toContainText("New session");
  await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
  await expect(page.getByRole("menuitem", { name: "Switch session", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const created = page.waitForResponse(
    (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/v1/sessions",
  );
  await main.getByTestId("content-editable").filter({ visible: true }).fill("Start from the placeholder");
  await main.getByTestId("send-message-button").filter({ visible: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const session = (await response.json()) as { id: string };
  await expect(page).toHaveURL(new RegExp(`/session\\?.*${session.id}`));
  await expect(main.getByRole("tab")).toHaveCount(1);
  await expect(main.getByRole("tab", { selected: true })).toContainText("Start from the placeholder");
  await main.getByRole("tab", { selected: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Close tab", exact: true }).click();
  await expect(main.getByRole("tab")).toHaveCount(0);
  await expect(main.getByTestId("content-editable").filter({ visible: true })).toBeVisible();
  await expect(breadcrumb).toContainText("New session");
  await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
  await page.getByRole("menuitem", { name: "Switch session", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Switch session", exact: true });
  await picker.getByRole("textbox").fill("Start from the placeholder");
  await picker.getByRole("textbox").press("Enter");
  await expect(main.getByRole("tab", { selected: true })).toContainText("Start from the placeholder");
};
