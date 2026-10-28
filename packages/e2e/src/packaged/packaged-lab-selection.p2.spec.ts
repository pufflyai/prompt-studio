import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect } from "@playwright/test";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { verifyLabSelection } from "../helpers/lab-selection";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { test } from "../scripts/playwright-test";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test.afterAll(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("Lab selections retain page views and share edits across panels before persistence", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-lab-selection-")));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    const started = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("extension-lab") });
    child = started.child;
    const folder = join(root, "project");
    mkdirSync(folder);
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Lab selection" }, folder)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader"] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => {
      if (window.top === window) localStorage.setItem("onboarding-complete", "true");
    });
    await signInBrowser(page, started.descriptor);
    await verifyLabSelection(page, `${started.baseUrl}/projects/${project.id}/`);
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
