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

// Route identity and fixed controls must survive browsing long extension lists and contribution details.
test("extension pages keep headers reachable and restore nested navigation", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "packaged-extension-pages-")));
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
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
        engines: { pstdio: "^0.3.0" },
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
    const catalog = join(root, "catalog.json");
    writeFileSync(
      catalog,
      JSON.stringify({
        version: 1,
        extensions: Array.from({ length: 40 }, (_, index) => ({
          installName: `tool-${index}`,
          extensionId: index === 0 ? "acme.tool" : `acme.tool-${index}`,
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
    const row = page
      .getByTestId("marketplace-extension-entry")
      .filter({ has: page.getByText("Example tool 0", { exact: true }) });
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(/extensions\/detail\?resource=/);
    const detailUrl = page.url();
    await expect(page.getByTestId("available-extension-detail")).toBeVisible();
    await expect(page.getByText("Example command 49", { exact: true })).toBeVisible();
    const title = page.getByTestId("available-extension-detail").getByText("Example tool 0", { exact: true });
    const detailTop = (await title.boundingBox())!.y;
    const detailScroll = page
      .getByTestId("available-extension-detail")
      .getByTestId("page-body-scroll")
      .locator("[data-part=viewport]");
    await expect(detailScroll).toBeVisible();
    expect(await detailScroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await detailScroll.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect.poll(() => detailScroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await expect.poll(async () => (await title.boundingBox())!.y).toBe(detailTop);
    await page.reload();
    await expect(page).toHaveURL(detailUrl);
    await expect(title).toBeVisible();
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Example tool 0");
    await page.getByTestId("extension-detail-back").click();
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
    await page.getByTestId("available-extension-install").click();
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
    const installedScroll = installedDetail.getByTestId("page-body-scroll").locator("[data-part=viewport]");
    expect(await installedScroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await installedScroll.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect.poll(() => installedScroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await expect.poll(async () => (await installedTitle.boundingBox())!.y).toBe(installedTop);
    await page.reload();
    await expect(page).toHaveURL(installedUrl);
    await expect(installedTitle).toBeVisible();
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Example tool 0");
    await page
      .getByRole("navigation", { name: "breadcrumb" })
      .getByRole("button", { name: "Extensions", exact: true })
      .click();
    await expect(page).toHaveURL(listUrl);
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { force: true, recursive: true });
  }
});
