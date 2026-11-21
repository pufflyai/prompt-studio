import type { Locator, Page } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { fixtureTest } from "../scripts/fixture-test";
import { expect, test } from "../scripts/playwright-test";
import { uiOrigin } from "../ui-server";

const headers = fixtureTest("panels", test);
const panel = (page: Page, id: string) => page.locator(`[data-workbench-panel="${id}"]:visible`);
const toolbar = (page: Page, id: string) => panel(page, id).frameLocator('iframe[title="Letter toolbar"]:visible');
const move = async (page: Page, target: Locator, name: string) => {
  await target.click({ button: "right" });
  await page.getByRole("menuitem", { name, exact: true }).click();
};

headers("keeps a public header view and menus with their live tab across destinations", async ({ page, request }) => {
  // Critical risk: hidden controls, wrong resource commands, or iframe reloads after moving a view.
  const created = await request.post(`${uiOrigin}/v1/projects`, { data: folderProjectInput({ name: "View headers" }) });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  await page.setViewportSize({ width: 1600, height: 1000 });
  try {
    await page.goto(`/projects/${id}/extensions/test.panel-views/mailbox`);
    await expect(toolbar(page, "main").getByText("Header for landing", { exact: true })).toBeVisible();
    await toolbar(page, "main").getByRole("textbox", { name: "Letter search" }).fill("keep this query");
    await panel(page, "main")
      .frameLocator('iframe[title="Letter viewer"]:visible')
      .getByRole("button", { name: "Switch to A", exact: true })
      .click();
    await expect(toolbar(page, "main").getByText("Header for A", { exact: true })).toBeVisible();
    await toolbar(page, "main").getByRole("textbox", { name: "Letter search" }).fill("A query");
    const mainMenu = panel(page, "main").frameLocator('iframe[title="Letter browser"]:visible');
    await mainMenu.getByRole("textbox", { name: "Letter menu draft" }).fill("menu state follows A");
    await panel(page, "main").getByRole("button", { name: "Close Main right menu", exact: true }).click();
    await move(page, page.locator('[data-workbench-panel-header="main"]'), "Move to Side");
    const side = panel(page, "side");
    const tab = side.getByRole("tab", { name: "Letter A", exact: true });
    await expect(tab).toBeVisible();
    const subheader = side.locator('[data-workbench-content-header="side"]');
    await expect(subheader).toBeVisible();
    await expect(toolbar(page, "side").getByRole("textbox", { name: "Letter search" })).toHaveValue("A query");
    await page.locator('[data-workbench-panel-header="main"]').click();
    await toolbar(page, "side").getByRole("textbox", { name: "Letter search" }).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(toolbar(page, "side").getByText("Command for A", { exact: true })).toBeVisible();
    await expect(
      side
        .locator('[data-workbench-panel-header="side"]')
        .getByRole("button", { name: /(?:Open|Close) Side right menu/ }),
    ).toHaveCount(0);
    await expect(subheader.getByRole("button", { name: /(?:Open|Close) Side right menu/ })).toBeVisible();

    await expect(side.locator('[data-workbench-panel-header="side"]')).toHaveCSS("border-bottom-width", "1px");
    await side.getByRole("button", { name: "Float Side Panel", exact: true }).click();
    await expect(side.locator('[data-workbench-panel-header="side"]')).toHaveCSS("border-bottom-width", "1px");
    await side.getByRole("button", { name: "Reattach Side Panel", exact: true }).click();
    await subheader.getByRole("button", { name: "Open Side right menu", exact: true }).click();
    await expect(
      page.frameLocator('iframe[title="Letter browser"]:visible').getByRole("textbox", { name: "Letter menu draft" }),
    ).toHaveValue("menu state follows A");
    await page.keyboard.press("Escape");
    await side.getByRole("button", { name: "Add panel", exact: true }).click();
    await expect(page.getByRole("menu", { name: "Add panel", exact: true })).toBeVisible();
    await page.getByRole("menuitem", { name: "New letter viewer", exact: true }).click({ timeout: 15_000 });
    await expect(side.frameLocator('iframe[title="Letter viewer"]:visible').getByText(/^Viewing draft-/)).toBeVisible();
    await side
      .frameLocator('iframe[title="Letter viewer"]:visible')
      .getByRole("button", { name: "Switch to B", exact: true })
      .click();
    await expect(toolbar(page, "side").getByText("Header for B", { exact: true })).toBeVisible();
    await toolbar(page, "side").getByRole("textbox", { name: "Letter search" }).fill("B query");
    await tab.click();
    await expect(toolbar(page, "side").getByRole("textbox", { name: "Letter search" })).toHaveValue("A query");
    await move(page, tab, "Move to Secondary");
    await expect(toolbar(page, "secondary").getByRole("textbox", { name: "Letter search" })).toHaveValue("A query");
    await expect(panel(page, "secondary").locator('[data-workbench-panel-header="secondary"]')).toHaveCSS(
      "border-bottom-width",
      "1px",
    );
    await expect(panel(page, "secondary").locator('[data-workbench-content-header="secondary"]')).toBeVisible();
    const secondaryMenu = panel(page, "secondary")
      .locator('[data-workbench-content-header="secondary"]')
      .getByRole("button", { name: /(?:Open|Close) Secondary right menu/ });
    await expect(secondaryMenu).toBeVisible();
    await secondaryMenu.click();
    await expect(
      page.frameLocator('iframe[title="Letter browser"]:visible').getByRole("textbox", { name: "Letter menu draft" }),
    ).toHaveValue("menu state follows A");
    await page.keyboard.press("Escape");
    await toolbar(page, "secondary").getByRole("button", { name: "Read header context" }).click();
    await expect(toolbar(page, "secondary").getByText("Command for A", { exact: true })).toBeVisible();
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});

headers("omits empty tab subheaders and keeps the tab separator", async ({ page, request }) => {
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Empty view header" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  try {
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(`/projects/${id}/extensions/test.panel-views/collection`);
    await expect(panel(page, "main").getByRole("tab", { name: "Letter browser", exact: true })).toBeVisible();
    await expect(panel(page, "main").locator('[data-workbench-content-header="main"]:visible')).toHaveCount(0);
    await expect(panel(page, "main").locator('[data-workbench-panel-header="main"]')).toHaveCSS(
      "border-bottom-width",
      "1px",
    );
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});

test("Extensions search remains usable after its page becomes a tab", async ({ page, request }) => {
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Extensions header" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  try {
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(`/projects/${id}/extensions`);
    const main = panel(page, "main");
    await expect(
      main.locator('[data-workbench-panel-header="main"]').getByRole("textbox", { name: /Search extensions/ }),
    ).toBeVisible();
    await main.getByRole("textbox", { name: /Search extensions/ }).fill("Canvas");
    await page.getByRole("button", { name: "Enter Main fullscreen", exact: true }).click();
    await expect(main.getByRole("textbox", { name: /Search extensions/ })).toHaveValue("Canvas");
    await page.getByRole("button", { name: "Exit Main fullscreen", exact: true }).click();
    await move(page, main.locator('[data-workbench-panel-header="main"]'), "Move to Side");
    const side = panel(page, "side");
    await expect(side.getByRole("tab", { name: "Extensions", exact: true })).toBeVisible();
    const search = side
      .locator('[data-workbench-content-header="side"]')
      .getByRole("textbox", { name: /Search extensions/ });
    await expect(search).toHaveValue("Canvas");
    await search.fill("no-such-extension-query");
    await expect(side.getByTestId("extensions-empty")).toBeVisible();
    await side.getByRole("button", { name: "Clear search", exact: true }).click();
    await expect(search).toHaveValue("");
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});
