import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const startFixtureServer = async () => {
  let loadCount = 0;
  const server = createServer((_request, response) => {
    loadCount += 1;
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`
      <!doctype html>
      <html>
        <body>
          <h1>Browser Preview Fixture</h1>
          <p>Fixture load ${loadCount}</p>
          <button>Interactive control</button>
        </body>
      </html>
    `);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${address.port}/` };
};

const stopServer = async (server: Server | undefined) => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  const projects = (await response.json()) as { id: string }[];
  for (const project of projects) await request.delete(`${apiBase}/v1/projects/${project.id}`);
};

const openPreviewFromPalette = async (page: import("@playwright/test").Page, url: string) => {
  await page.keyboard.press("ControlOrMeta+KeyK");
  const palette = page.getByRole("dialog").getByRole("textbox");
  await expect(palette).toBeVisible();
  await palette.fill("> browser");
  await page.getByText("Browser: Open Preview", { exact: true }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill(url);
  await dialog.getByRole("button", { name: "Run", exact: true }).click();
};

const visiblePreview = (page: import("@playwright/test").Page) =>
  page.locator('iframe[title="Browser Preview"]:visible').contentFrame();

const visiblePreviewPanel = (page: import("@playwright/test").Page) =>
  page
    .locator('iframe[title="Browser Preview"]:visible')
    .locator('xpath=ancestor::div[.//input[@aria-label="Browser Preview address"]][1]');

const visibleButton = (page: import("@playwright/test").Page, name: string) =>
  visiblePreviewPanel(page).getByRole("button", { name, exact: true });

test.describe("Browser Preview", () => {
  let fixture: Awaited<ReturnType<typeof startFixtureServer>> | undefined;

  test.beforeAll(async () => {
    fixture = await startFixtureServer();
  });

  test.afterAll(async () => {
    await stopServer(fixture?.server);
  });

  test.beforeEach(async ({ page, request }) => {
    await deleteAllProjects(request);
    const projectResponse = await request.post(`${apiBase}/v1/projects`, {
      data: { name: "Browser Preview Project" },
    });
    expect(projectResponse.ok()).toBe(true);
    const project = (await projectResponse.json()) as { id: string };

    await page.addInitScript((projectId) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
      localStorage.setItem("dashboard-wb:selected-project:global", projectId);
    }, project.id);
    await page.goto(`/projects/${project.id}/tickets`);
    await expect(page.getByRole("button", { name: /Browser Preview Project/ })).toBeVisible();
    const tickets = page.getByRole("option", { name: "Tickets", exact: true });
    await expect(tickets).toBeVisible();
    await tickets.click();
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Tickets");
  });

  test("opens duplicate tabs, keeps inactive pages alive, restores state, and forgets closed previews", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const mainTabs = page.locator('[data-workbench-panel-header="main"]').getByRole("tab");

    await openPreviewFromPalette(page, fixture!.url);
    await expect(visiblePreview(page).getByText("Fixture load 1")).toBeVisible();

    await page.getByLabel("Browser Preview address").fill("file:///tmp/index.html");
    await page.getByRole("button", { name: "Open address" }).click();
    await expect(page.getByText("Browser Preview supports only HTTP(S) URLs.")).toBeVisible();
    await expect(visiblePreview(page).getByText("Fixture load 1")).toBeVisible();

    await visibleButton(page, "Mobile").click();
    await expect(visibleButton(page, "Mobile")).toHaveAttribute("aria-pressed", "true");
    const firstFrameWidth = await page
      .locator('iframe[title="Browser Preview"]:visible')
      .evaluate((frame) => Math.round(frame.getBoundingClientRect().width));
    expect(firstFrameWidth).toBeGreaterThanOrEqual(388);
    expect(firstFrameWidth).toBeLessThanOrEqual(390);

    await openPreviewFromPalette(page, fixture!.url);
    await expect(visiblePreview(page).getByText("Fixture load 2")).toBeVisible();
    await expect(visibleButton(page, "Responsive")).toHaveAttribute("aria-pressed", "true");

    const previewTabs = mainTabs.filter({ hasText: new URL(fixture!.url).host });
    await expect(previewTabs).toHaveCount(2);

    await previewTabs.first().click();
    await expect(visiblePreview(page).getByText("Fixture load 1")).toBeVisible();
    await visiblePreviewPanel(page).getByRole("button", { name: "Copy preview URL" }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(fixture!.url);

    const popupPromise = page.waitForEvent("popup");
    await visiblePreviewPanel(page).getByRole("button", { name: "Open preview externally" }).click();
    const popup = await popupPromise;
    await expect.poll(() => popup.url()).toBe(fixture!.url);
    expect(await popup.evaluate(() => globalThis.opener)).toBeNull();
    await popup.close();

    await page.reload();
    await expect(
      page
        .locator('[data-workbench-panel-header="main"]')
        .getByRole("tab")
        .filter({
          hasText: new URL(fixture!.url).host,
        }),
    ).toHaveCount(2);
    await expect(visibleButton(page, "Mobile")).toHaveAttribute("aria-pressed", "true");

    const restoredPreviewTabs = page
      .locator('[data-workbench-panel-header="main"]')
      .getByRole("tab")
      .filter({ hasText: new URL(fixture!.url).host });
    await restoredPreviewTabs.last().click();
    await restoredPreviewTabs
      .last()
      .getByRole("button", { name: /^Close/ })
      .click();
    await expect(restoredPreviewTabs).toHaveCount(1);

    await page.reload();
    await expect(
      page
        .locator('[data-workbench-panel-header="main"]')
        .getByRole("tab")
        .filter({
          hasText: new URL(fixture!.url).host,
        }),
    ).toHaveCount(1);
  });
});
