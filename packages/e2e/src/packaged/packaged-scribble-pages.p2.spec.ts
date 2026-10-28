import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { verifyScribblePages } from "../helpers/scribble-pages";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { test } from "../scripts/playwright-test";
import { preparePackagedExtensionSource } from "./packaged-extension-source";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test.afterAll(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("Scribble retains pages, saves preview tabs, orders its tree and switches projects", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-scribble-pages-")));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    const source = await preparePackagedExtensionSource(
      join(root, "fixture"),
      join(import.meta.dirname, "../../../../extensions/extension-lab"),
    );
    const started = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({ defaultExtensions: [{ source, installName: "extension-lab" }] }),
    });
    child = started.child;
    const create = async (name: string, folder: string) => {
      mkdirSync(folder);
      const response = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name }, folder)),
      });
      expect(response.status).toBe(201);
      return (await response.json()) as { id: string; name: string };
    };
    const first = await create("Scribble pages", join(root, "first"));
    const second = await create("Other Scribble project", join(root, "second"));
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => {
      if (window.top === window) localStorage.setItem("onboarding-complete", "true");
    });
    await signInBrowser(page, started.descriptor);
    await verifyScribblePages(page, `${started.baseUrl}/projects/${first.id}/`, second);
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
