import type { Locator, Page } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { fixtureTest } from "../scripts/fixture-test";
import { expect, test } from "../scripts/playwright-test";
import { uiOrigin } from "../ui-server";

const headers = fixtureTest("panels", test);
const panel = (page: Page, id: string) => page.locator(`[data-workbench-panel="${id}"]:visible`);
const toolbar = (page: Page, id: string) =>
  page.frameLocator(`[data-workbench-header-panel="${id}"] iframe[title="Letter toolbar"]:visible`);
const openToolbar = async (page: Page, id: string) => {
  const position = await panel(page, id)
    .locator("[data-workbench-content-header]")
    .getAttribute("data-menu-header-position");
  if (position === "left" || position === "right")
    await panel(page, id).getByRole("button", { name: "View controls", exact: true }).click();
  await expect(toolbar(page, id).getByRole("textbox", { name: "Letter search" })).toBeVisible();
};
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
    await expect(toolbar(page, "main").getByLabel("Header for landing", { exact: true })).toBeVisible();
    await toolbar(page, "main").getByRole("textbox", { name: "Letter search" }).fill("keep this query");
    await panel(page, "main")
      .frameLocator('iframe[title="Letter viewer"]:visible')
      .getByRole("button", { name: "Switch to A", exact: true })
      .click();
    await expect(toolbar(page, "main").getByLabel("Header for A", { exact: true })).toBeVisible();
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
    await openToolbar(page, "side");
    await expect(toolbar(page, "side").getByRole("textbox", { name: "Letter search" })).toHaveValue("A query");
    await page.locator('[data-workbench-panel-header="main"]').click();
    await openToolbar(page, "side");
    await toolbar(page, "side").getByRole("textbox", { name: "Letter search" }).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(toolbar(page, "side").getByRole("status", { name: "Header context", exact: true })).toHaveText(
      "Command for A",
    );
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
    await openToolbar(page, "side");
    await expect(toolbar(page, "side").getByLabel("Header for B", { exact: true })).toBeVisible();
    await toolbar(page, "side").getByRole("textbox", { name: "Letter search" }).fill("B query");
    await tab.click();
    await openToolbar(page, "side");
    await expect(toolbar(page, "side").getByRole("textbox", { name: "Letter search" })).toHaveValue("A query");
    await move(page, tab, "Move to Secondary");
    await openToolbar(page, "secondary");
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
    await openToolbar(page, "secondary");
    await toolbar(page, "secondary").getByRole("button", { name: "Read header context" }).click();
    await expect(toolbar(page, "secondary").getByRole("status", { name: "Header context", exact: true })).toHaveText(
      "Command for A",
    );
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
      main.locator('[data-workbench-content-header="main"]').getByRole("textbox", { name: /Search extensions/ }),
    ).toBeVisible();
    const mainSearch = main.getByRole("textbox", { name: /Search extensions/ });
    await mainSearch.fill("Canvas search text");
    await mainSearch.press("Home");
    const input = (await mainSearch.boundingBox())!;
    await page.mouse.move(input.x + 12, input.y + input.height / 2);
    await page.mouse.down();
    await page.mouse.move(input.x + 72, input.y + input.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect
      .poll(() =>
        mainSearch.evaluate((node: HTMLInputElement) =>
          Math.abs((node.selectionEnd ?? 0) - (node.selectionStart ?? 0)),
        ),
      )
      .toBeGreaterThan(0);
    await mainSearch.fill("Canvas");
    await page.getByRole("button", { name: "Enter Main fullscreen", exact: true }).click();
    await expect(main.getByRole("textbox", { name: /Search extensions/ })).toHaveValue("Canvas");
    await page.getByRole("button", { name: "Exit Main fullscreen", exact: true }).click();
    await move(page, main.locator('[data-workbench-panel-header="main"]'), "Move to Side");
    const side = panel(page, "side");
    await expect(side.getByRole("tab", { name: "Extensions", exact: true })).toBeVisible();
    const search = page
      .locator('[data-workbench-header-panel="side"]')
      .getByRole("textbox", { name: /Search extensions/ });
    await expect(search).toHaveValue("Canvas");
    await search.fill("no-such-extension-query");
    await expect(side.getByTestId("extensions-empty")).toBeVisible();
    await page.keyboard.press("Escape");
    await side.getByRole("button", { name: "Clear search", exact: true }).click();
    await expect(search).toHaveValue("");
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});

headers(
  "docks one menu header, reorders icons and restores independent menus after floating",
  async ({ page, request }) => {
    const created = await request.post(`${uiOrigin}/v1/projects`, {
      data: folderProjectInput({ name: "Movable menu header" }),
    });
    expect(created.ok()).toBe(true);
    const { id } = await created.json();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.setViewportSize({ width: 1600, height: 1000 });
    try {
      await page.goto(`/projects/${id}/extensions/test.panel-views/mailbox`);
      const main = panel(page, "main");
      const header = main.locator('[data-workbench-content-header="main"]');
      await expect(toolbar(page, "main").getByRole("textbox", { name: "Letter search" })).toBeVisible();
      await toolbar(page, "main").getByRole("textbox", { name: "Letter search" }).fill("keep while docking");
      await expect(main.locator('[data-workbench-panel-menu="main-right-menu"]')).toBeVisible();
      await expect(main.locator('[data-workbench-panel-menu="main-bottom-menu"]')).toBeVisible();
      await move(
        page,
        main.getByRole("button", { name: "Close Main right menu", exact: true }),
        "Open Letter browser on the bottom",
      );
      await expect(main.locator('[data-workbench-panel-menu="main-bottom-menu"]')).toBeVisible();
      await main.getByRole("button", { name: "Close Main bottom menu: Letter browser", exact: true }).click();
      await page.setViewportSize({ width: 1600, height: 400 });
      await expect(page.getByRole("dialog", { name: "Letter browser", exact: true })).not.toBeVisible();
      await move(
        page,
        main.getByRole("button", { name: "Open Main bottom menu: Letter browser", exact: true }),
        "Open Letter browser on the right",
      );
      await expect(main.locator('[data-workbench-panel-menu="main-right-menu"]')).toBeVisible();
      await move(
        page,
        main.getByRole("button", { name: "Close Main right menu", exact: true }),
        "Open Letter browser on the bottom",
      );
      await expect(page.getByRole("dialog", { name: "Letter browser", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await move(
        page,
        main.getByRole("button", { name: "Open Main bottom menu: Letter browser", exact: true }),
        "Open Letter browser on the right",
      );
      await expect(main.locator('[data-workbench-panel-menu="main-right-menu"]')).toBeVisible();
      await page.setViewportSize({ width: 1600, height: 1000 });
      await main.getByRole("button", { name: "Open Main bottom menu", exact: true }).click();
      await expect(main.locator('[data-workbench-panel-menu="main-bottom-menu"]')).toBeVisible();
      await expect(main.locator('[data-workbench-panel-menu="main-right-menu"]')).toBeVisible();
      const activity = main.getByRole("button", { name: "Close Main bottom menu", exact: true });
      await move(page, activity, "Open Letter activity on the left");
      await expect(main.locator('[data-workbench-panel-menu="main-left-menu"]')).toBeVisible();
      const iconOrder = () =>
        header
          .locator("[data-action-bar-item]")
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-action-bar-item")));
      const beforeDrag = await iconOrder();
      const browserButton = header.getByRole("button", { name: "Close Main right menu", exact: true });
      const activityButton = header.getByRole("button", { name: "Close Main left menu", exact: true });
      const source = (await browserButton.boundingBox())!;
      const target = (await activityButton.boundingBox())!;
      await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
      await page.mouse.down();
      await page.mouse.move(target.x + 2, target.y + target.height / 2, { steps: 10 });
      await page.mouse.up();
      await expect.poll(iconOrder).not.toEqual(beforeDrag);
      await expect(header).toHaveAttribute("data-menu-header-position", "top");
      const dockBounds = (await header.boundingBox())!;
      await page.mouse.move(dockBounds.x + 8, dockBounds.y + dockBounds.height / 2);
      await page.mouse.down();
      await page.mouse.move(dockBounds.x + 24, dockBounds.y + dockBounds.height / 2, { steps: 4 });
      const rightDock = main.locator('[data-menu-header-drop="right"]');
      await expect(rightDock).toBeVisible();
      const dockTarget = (await rightDock.boundingBox())!;
      await page.mouse.move(dockTarget.x + dockTarget.width / 2, dockTarget.y + dockTarget.height / 2, { steps: 10 });
      await page.mouse.up();
      await expect(header).toHaveAttribute("data-menu-header-position", "right");
      await expect(main.locator("[data-workbench-content-header]")).toHaveCount(1);
      const bounds = await header.boundingBox();
      const ownerBounds = await main.boundingBox();
      expect(Math.abs(bounds!.x + bounds!.width - ownerBounds!.x - ownerBounds!.width)).toBeLessThan(2);
      expect(bounds!.width).toBeLessThan(40);
      await openToolbar(page, "main");
      await expect(toolbar(page, "main").getByRole("textbox", { name: "Letter search" })).toHaveValue(
        "keep while docking",
      );
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "View controls", exact: true })).toBeHidden();
      await expect(header.getByRole("button", { name: "View controls", exact: true })).toBeFocused();
      const lastIcon = header.getByRole("button", { name: "Close Main right menu", exact: true });
      const beforeOrder = await header
        .locator("[data-action-bar-item]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-action-bar-item")));
      await lastIcon.focus();
      await expect(lastIcon).toBeFocused();
      await page.keyboard.press("Alt+ArrowUp");
      await expect
        .poll(() =>
          header
            .locator("[data-action-bar-item]")
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-action-bar-item"))),
        )
        .not.toEqual(beforeOrder);
      const order = await header
        .locator("[data-action-bar-item]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-action-bar-item")));
      await page.setViewportSize({ width: 700, height: 600 });
      await expect(header).toHaveAttribute("aria-label", "Menu header dock");
      await expect(header.getByRole("toolbar", { name: "Menu header", exact: true })).toBeVisible();
      await expect(main.locator('[data-workbench-panel-menu="main-left-menu"]')).not.toBeVisible();
      await move(
        page,
        header.getByRole("button", { name: "Open Main right menu", exact: true }),
        "Open Letter browser on the right",
      );
      await expect(page.getByRole("dialog", { name: "Letter browser", exact: true })).toBeVisible();
      await header.getByRole("button", { name: "Open Main left menu", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Letter activity", exact: true })).toBeVisible();
      await expect(page.getByRole("dialog", { name: "Letter browser", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 1600, height: 1000 });
      await expect(header).toHaveAttribute("aria-label", "Menu header dock");
      await expect(main.locator('[data-workbench-panel-menu="main-left-menu"]')).toBeVisible();
      await expect(main.locator('[data-workbench-panel-menu="main-right-menu"]')).toBeVisible();
      await page.reload();
      await expect(header).toHaveAttribute("data-menu-header-position", "right");
      await expect
        .poll(() =>
          header
            .locator("[data-action-bar-item]")
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-action-bar-item"))),
        )
        .toEqual(order);
    } finally {
      await request.delete(`${uiOrigin}/v1/projects/${id}`);
    }
  },
);
