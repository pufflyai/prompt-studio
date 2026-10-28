import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { writePageParamsExtension } from "../helpers/page-params-extension";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();

test("packaged page params and server preferences survive browser and runtime restarts", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-page-params-"));
  let child: ChildProcess | null = null;
  const browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
  try {
    writePageParamsExtension(root);
    let started = await startPackagedServe(root);
    child = started.child;
    const documentation = await fetch(`${started.baseUrl}/openapi.json`, {
      headers: runtimeAuthorization(started.descriptor),
    });
    expect(documentation.status).toBe(200);
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Page params" }, root)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    const page = await browser.newPage();
    await signInBrowser(page, started.descriptor);
    const path = `/projects/${project.id}/extensions/test.page-params/board?range=now-6h`;
    await page.goto(`${started.baseUrl}${path}`);
    const view = page.frameLocator('iframe[title="Page params"]');
    await view.locator("#range").getByText("now-6h").waitFor();
    await view.getByRole("button", { name: "Save preference" }).click();
    await view.locator("#saved").getByText("now-6h").waitFor();
    await page.reload();
    await view.locator("#saved").getByText("now-6h").waitFor();
    await stopProcess(child);
    child = null;
    started = await startPackagedServe(root);
    child = started.child;
    await signInBrowser(page, started.descriptor);
    await page.goto(`${started.baseUrl}${path}`);
    await view.locator("#saved").getByText("now-6h").waitFor();
    expect(await view.locator("#range").textContent()).toBe("now-6h");
  } finally {
    await browser.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
