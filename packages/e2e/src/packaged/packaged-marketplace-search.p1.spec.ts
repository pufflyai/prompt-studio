import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test.afterAll(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

// A visible full ID must locate its download even when the catalog uses a different install name.
test("packaged marketplace search finds an extension by its visible full ID", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-packaged-marketplace-search-")));
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    const catalog = join(root, "catalog.json");
    writeFileSync(
      catalog,
      JSON.stringify({
        version: 1,
        extensions: [
          {
            installName: "planning-tools",
            extensionId: "acme.roadmap",
            displayName: "Planning tools",
            description: "Organize your tasks",
            default: false,
            origin: { kind: "git", url: "https://example.com/tools.git", ref: "main", path: "planning" },
          },
        ],
      }),
    );
    const started = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: "[]",
      PSTDIO_EXTENSION_CATALOG: catalog,
    });
    child = started.child;
    const folder = join(root, "project");
    mkdirSync(folder);
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Marketplace search" }, folder)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    browser = await chromium.launch({ headless: true, ...PROVISIONED_CHROMIUM });
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, started.descriptor);
    await page.goto(`${started.baseUrl}/projects/${project.id}/extensions`);
    const row = page.getByTestId("marketplace-extension-entry").filter({
      has: page.getByText("acme.roadmap", { exact: true }),
    });
    await expect(row).toBeVisible();
    const search = page.getByTestId("extensions-search");
    await search.fill(" ACME.ROADMAP ");
    await expect(row).toBeVisible();
    await search.fill("planning-tools");
    await expect(row).toBeVisible();
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { force: true, recursive: true });
  }
});
