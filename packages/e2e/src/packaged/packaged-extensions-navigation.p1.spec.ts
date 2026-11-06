import { type ChildProcess, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { folderProjectInput } from "../helpers/folder-project";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

const createRepository = (root: string) => {
  const repo = join(root, "repository");
  mkdirSync(join(repo, "tool"), { recursive: true });
  writeFileSync(
    join(repo, "tool/package.json"),
    JSON.stringify({
      name: "tool",
      publisher: "acme",
      displayName: "Example tool 0",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: "^0.4.0" },
    }),
  );
  const commands = Array.from({ length: 50 }, (_, index) => ({
    id: `command-${index}`,
    ref: { kind: "command", id: `command-${index}` },
    title: `Example command ${index}`,
    run: "() => null",
  }));
  writeFileSync(
    join(repo, "tool/extension.ts"),
    `export default ${JSON.stringify({ commands }).replaceAll('"() => null"', "() => null")};`,
  );
  for (const args of [
    ["init", "-q"],
    ["add", "."],
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "Fixture"],
  ]) {
    const result = spawnSync("git", args, { cwd: repo });
    expect(result.status, result.stderr.toString()).toBe(0);
  }
  return repo;
};

// Route identity and fixed controls must survive browsing long extension lists and contribution details.
test("extension pages keep headers reachable and restore nested navigation", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "packaged-extension-pages-")));
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    const repo = createRepository(root);
    const longId = `acme.${"extension-".repeat(40)}tools`;
    const catalog = join(root, "catalog.json");
    writeFileSync(
      catalog,
      JSON.stringify({
        version: 1,
        extensions: Array.from({ length: 40 }, (_, index) => ({
          installName: `tool-${index}`,
          extensionId: ["acme.tool", longId][index] ?? `acme.tool-${index}`,
          displayName: `Example tool ${index}`,
          description: "Example extension",
          default: false,
          origin: { kind: "git", url: pathToFileURL(repo).href, ref: "HEAD", path: "tool" },
        })),
      }),
    );
    const runtime = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: "[]",
      PSTDIO_EXTENSION_CATALOG: catalog,
    });
    child = runtime.child;
    mkdirSync(join(root, "project"));
    const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Extension pages" }, join(root, "project"))),
    });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { id: string };
    browser = await chromium.launch({ headless: true, ...PROVISIONED_CHROMIUM });
    const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, runtime.descriptor);
    const listUrl = `${runtime.baseUrl}/projects/${project.id}/extensions`;
    await page.goto(listUrl);
    const availableDetail = page.getByTestId("available-extension-detail").filter({ visible: true });
    const search = page.getByTestId("extensions-search");
    await expect(search).toBeVisible();
    const headerTop = (await search.boundingBox())!.y;
    const listScroll = page
      .getByTestId("extensions-panel")
      .getByTestId("page-body-scroll")
      .locator("[data-part=viewport]");
    await expect(listScroll).toBeVisible();
    expect(await listScroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await listScroll.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect.poll(() => listScroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await expect.poll(async () => (await search.boundingBox())!.y).toBe(headerTop);
    await listScroll.evaluate((node) => {
      node.scrollTop = 0;
    });
    const longRow = page
      .getByTestId("marketplace-extension-entry")
      .filter({ has: page.getByText(longId, { exact: true }) });
    await expect(longRow).toBeVisible();
    // A visible row must not clip its primary action when an ID exceeds the available width.
    const rowAction = longRow.getByTestId("marketplace-extension-install");
    expect(
      await rowAction.evaluate((node) => {
        const action = node.getBoundingClientRect();
        const row = node.closest('[data-testid="marketplace-extension-entry"]')!.getBoundingClientRect();
        return action.right <= row.right && action.left >= row.left;
      }),
    ).toBe(true);
    const rowIdentity = (await longRow.getByText(longId, { exact: true }).boundingBox())!;
    expect(rowIdentity.x + rowIdentity.width).toBeLessThanOrEqual((await rowAction.boundingBox())!.x);
    await longRow.click();
    const longDetail = availableDetail;
    await expect(longDetail.getByText(longId, { exact: true })).toBeVisible();
    const detailIdentity = (await longDetail.getByText(longId, { exact: true }).boundingBox())!;
    expect(detailIdentity.x + detailIdentity.width).toBeLessThanOrEqual(
      (await longDetail.getByTestId("available-extension-install").boundingBox())!.x,
    );
    expect(await longDetail.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await longDetail.getByTestId("extension-detail-back").click();
    await expect(page).toHaveURL(listUrl);
    const row = page
      .getByTestId("marketplace-extension-entry")
      .filter({ has: page.getByText("Example tool 0", { exact: true }) });
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(/extensions\/detail\?resource=/);
    const detailUrl = page.url();
    await expect(availableDetail).toBeVisible();
    await expect(availableDetail.getByText("Example command 49", { exact: true })).toBeVisible();
    const title = availableDetail.getByText("Example tool 0", { exact: true });
    const detailTop = (await title.boundingBox())!.y;
    const availableTabs = availableDetail.getByRole("tablist");
    const availableTabsTop = (await availableTabs.boundingBox())!.y;
    const detailScroll = availableDetail.getByTestId("page-body-scroll").locator("[data-part=viewport]");
    await expect(detailScroll).toBeVisible();
    expect(await detailScroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await detailScroll.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect.poll(() => detailScroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await expect.poll(async () => (await title.boundingBox())!.y).toBe(detailTop);
    await expect.poll(async () => (await availableTabs.boundingBox())!.y).toBe(availableTabsTop);
    await page.reload();
    await expect(page).toHaveURL(detailUrl);
    await expect(title).toBeVisible();
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Example tool 0");
    await availableDetail.getByTestId("extension-detail-back").click();
    await expect(page).toHaveURL(listUrl);
    await page.goBack();
    await expect(page).toHaveURL(detailUrl);
    await expect(title).toBeVisible();
    const parent = page
      .getByRole("navigation", { name: "breadcrumb" })
      .getByRole("button", { name: "Extensions", exact: true });
    await expect(parent).toBeVisible();
    await parent.click();
    await expect(page).toHaveURL(listUrl);
    await row.click();
    await availableDetail.getByTestId("available-extension-install").click();
    const installed = page
      .getByTestId("extension-entry")
      .filter({ visible: true })
      .filter({ has: page.getByText("Example tool 0", { exact: true }) });
    await expect(installed).toBeVisible();
    await installed.click();
    const installedDetail = page.getByTestId("extension-detail");
    await expect(installedDetail).toBeVisible();
    const installedUrl = page.url();
    await expect(page).toHaveURL(/extensions\/detail\?resource=/);
    await page.getByRole("tab", { name: "Contributions", exact: true }).click();
    const installedTitle = installedDetail.getByText("Example tool 0", { exact: true });
    const installedTop = (await installedTitle.boundingBox())!.y;
    const installedTabs = installedDetail.getByRole("tablist");
    const installedTabsTop = (await installedTabs.boundingBox())!.y;
    const installedScroll = installedDetail.getByTestId("page-body-scroll").locator("[data-part=viewport]");
    expect(await installedScroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await installedScroll.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect.poll(() => installedScroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await expect.poll(async () => (await installedTitle.boundingBox())!.y).toBe(installedTop);
    await expect.poll(async () => (await installedTabs.boundingBox())!.y).toBe(installedTabsTop);
    await page.reload();
    await expect(page).toHaveURL(installedUrl);
    await expect(installedTitle).toBeVisible();
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Example tool 0");
    await page
      .getByRole("navigation", { name: "breadcrumb" })
      .getByRole("button", { name: "Extensions", exact: true })
      .click();
    await expect(page).toHaveURL(listUrl);
    const toggle = installed.getByRole("checkbox");
    await expect(toggle).toBeChecked();
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(listUrl);
    await expect(toggle).not.toBeChecked();
    await installed.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(installedUrl);
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { force: true, recursive: true });
  }
});
