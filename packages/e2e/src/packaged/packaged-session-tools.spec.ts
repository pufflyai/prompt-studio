import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, test } from "@playwright/test";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { verifySessionTools } from "../helpers/session-tools";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test("packaged Sessions creates sessions from the default tools and Add menu", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-session-placeholder-"));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    const started = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture") });
    child = started.child;
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Packaged session placeholder" }, root)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    browser = await chromium.launch(PROVISIONED_CHROMIUM);
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    });
    await signInBrowser(page, started.descriptor);
    await page.goto(`${started.baseUrl}/projects/${project.id}/sessions`);
    await verifySessionTools(page);
    await page.screenshot({ path: test.info().outputPath("session-created.png") });
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
