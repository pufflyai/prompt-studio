import { expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

const panel = (page: Page, id: string) => page.locator(`[data-workbench-panel="${id}"]`);
const openTool = async (page: Page, id: "side" | "secondary", label: string) => {
  const show = page.getByRole("button", { name: id === "side" ? "Show Side Panel" : "Show Bottom Panel", exact: true });
  if (await show.isVisible()) await show.click();
  await page
    .locator(`[data-workbench-panel-header="${id}"]`)
    .getByRole("button", { name: "Add panel", exact: true })
    .click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
};
const prepare = async (page: Page) => {
  await page.addInitScript(() => {
    if (window === window.top) localStorage.setItem("onboarding-complete", "true");
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
};

test("tabless pages render their content without tab headers", async ({ page, request }) => {
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Page presentation" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  try {
    await prepare(page);
    await page.goto(`/projects/${id}`);
    await expect(page.getByTestId("start-page")).toBeVisible();
    await expect(page.locator('[data-workbench-panel-header="main"]')).toHaveCount(0);
    await expect(panel(page, "main").getByRole("group", { name: "Available tabs" })).toHaveCount(0);
    await page.getByRole("option", { name: "Sessions", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("New session");
    await expect(panel(page, "main").getByRole("tab")).toHaveCount(0);
    await expect(panel(page, "main").getByRole("button", { name: "Add panel", exact: true })).toHaveCount(0);
    await page.goBack();
    await expect(page.getByTestId("start-page")).toBeVisible();
    await expect(page.locator('[data-workbench-panel-header="main"]')).toHaveCount(0);
    for (const path of ["tickets", "ticket-timeline"]) {
      await page.goto(`/projects/${id}/extensions/pstdio.pstdio-planner/${path}`);
      await expect(page.getByRole("navigation", { name: "breadcrumb" })).toBeVisible();
      await expect(panel(page, "main").getByRole("tab")).toHaveCount(0);
      await expect(panel(page, "main").getByRole("button", { name: "Add panel", exact: true })).toHaveCount(0);
      await expect(page.locator('[data-workbench-tab-strip="main"]')).toHaveCount(0);
      await expect(page.locator('[data-workbench-panel-header="main"]')).toHaveCount(0);
      if (path === "ticket-timeline") {
        await expect(
          page
            .frameLocator('iframe[title="Project Timeline"]')
            .getByRole("button", { name: "Auto Build", exact: true }),
        ).toBeVisible();
      }
    }
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});

test("an SDK-only viewer switches locally, reuses resources, replaces drafts and closes on deletion", async ({
  page,
  request,
}) => {
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Panel viewers" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  try {
    await prepare(page);
    await page.goto(`/projects/${id}/extensions/pstdio.workbench-fixture/mailbox`);
    const main = panel(page, "main");
    const mainReader = main.frameLocator('iframe[title="Letter viewer"]:visible');
    await expect(mainReader.getByText("Viewing landing", { exact: true })).toBeVisible();
    await mainReader.getByRole("button", { name: "Switch to A", exact: true }).click();
    await expect(mainReader.getByText("Viewing A", { exact: true })).toBeVisible();
    const mainUrl = page.url();
    await openTool(page, "side", "Letter viewer");
    const side = panel(page, "side");
    const sideReader = side.frameLocator('iframe[title="Letter viewer"]:visible');
    await sideReader.getByRole("button", { name: "Switch to B", exact: true }).click();
    await expect(sideReader.getByText("Viewing B", { exact: true })).toBeVisible();
    await sideReader.getByRole("button", { name: "Switch to A", exact: true }).click();
    await expect(sideReader.getByText("Viewing B", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(mainUrl);
    await expect(mainReader.getByText("Viewing A", { exact: true })).toBeVisible();
    await openTool(page, "secondary", "Letter browser");
    const browser = panel(page, "secondary").frameLocator('iframe[title="Letter browser"]:visible');
    await browser.getByRole("button", { name: "Open B in Main", exact: true }).click();
    await expect(page).toHaveURL(mainUrl);
    await expect(side.getByRole("tab", { name: "Letter B", exact: true })).toHaveAttribute("aria-selected", "true");
    await sideReader.getByRole("button", { name: "Save letter", exact: true }).click();
    await expect(sideReader.getByText(/^Viewing saved-/)).toBeVisible();
    await expect(page).toHaveURL(mainUrl);
    await sideReader.getByRole("button", { name: "Delete letter", exact: true }).click();
    await expect(side.getByRole("tab", { name: /^Letter saved-/ })).toHaveCount(0);
    await expect(browser.getByRole("heading", { name: "Letter browser", exact: true })).toBeVisible();
    await mainReader.getByRole("button", { name: "Delete letter", exact: true }).click();
    await expect(mainReader.getByText("Viewing landing", { exact: true })).toBeVisible();
    await page.reload();
    await expect(mainReader.getByText("Viewing landing", { exact: true })).toBeVisible();
    await expect(side.getByRole("tab", { name: /^Letter saved-/ })).toHaveCount(0);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});

test("a reusable viewer moved into a collection stays in that collection when selected and switched", async ({
  page,
  request,
}) => {
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Collection viewer" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  try {
    await prepare(page);
    await page.goto(`/projects/${id}/extensions/pstdio.pstdio-artifacts/artifacts`);
    await expect(panel(page, "main").getByRole("tab", { name: "Artifacts", exact: true })).toBeVisible();
    await openTool(page, "side", "Letter viewer");
    const side = panel(page, "side");
    const source = side.getByRole("tab", { name: /^Letter draft-/ });
    await expect(source).toBeVisible();
    await source.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Move to Main", exact: true }).click();
    const main = panel(page, "main");
    const moved = main.getByRole("tab", { name: /^Letter draft-/ });
    await expect(moved).toBeVisible();
    await moved.click();
    const collectionUrl = `/projects/${id}/extensions/pstdio.pstdio-artifacts/artifacts`;
    await expect(page).toHaveURL(collectionUrl);
    const reader = main.frameLocator('iframe[title="Letter viewer"]:visible');
    await reader.getByRole("button", { name: "Switch to B", exact: true }).click();
    await expect(reader.getByText("Viewing B", { exact: true })).toBeVisible();
    await expect(main.getByRole("tab", { name: "Letter B", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(collectionUrl);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});
