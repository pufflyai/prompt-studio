import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect as browserExpect, chromium } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { installBuiltSdk } from "../helpers/installed-sdk";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

const writeExtension = (root: string) => {
  const source = join(root, "extensions", "resource-removal");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "resource-removal",
      publisher: "e2e",
      version: "0.1.0",
      main: "extension.ts",
      type: "module",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  cpSync(join(import.meta.dirname, "../fixtures/resource-removal/extension.ts"), join(source, "extension.ts"));
  installBuiltSdk(source);
};

setupPackagedSmokeTests();

test("packaged related loading cannot reopen a resource deleted during resolution", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-resource-removal-"));
  let child: ChildProcess | undefined;
  const browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
  const release = Promise.withResolvers<void>();
  try {
    writeExtension(root);
    const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    child = runtime.child;
    const response = await fetch(`${runtime.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Removal" }, root)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, runtime.descriptor);
    await page.goto(`${runtime.baseUrl}/projects/${project.id}/`);
    const source = page.getByText("Removal source", { exact: true }).first();
    const deleted = page.locator('[data-workbench-panel-header="side"]').getByRole("tab", { name: /Deleted target/ });
    const kept = page.locator('[data-workbench-panel-header="secondary"]').getByRole("tab", { name: /Kept target/ });
    await source.click();
    await browserExpect(deleted).toBeVisible();
    await deleted.focus();
    await page.keyboard.press("Shift+F10");
    await page.getByRole("menuitem", { name: "Pin tab", exact: true }).click();
    await page.getByText("Removal home", { exact: true }).first().click();
    await browserExpect(kept).toHaveCount(0);
    const held = Promise.withResolvers<void>();
    await page.route("**/e2e.resource-removal.command.resolve/execute", async (route) => {
      const resources = route.request().postDataJSON().params?.resources as Array<{ id: string }> | undefined;
      if (
        !resources?.some((resource) => resource.id === "deleted") ||
        !resources.some((resource) => resource.id === "kept")
      )
        return route.continue();
      const result = await route.fetch();
      held.resolve();
      await release.promise;
      await route.fulfill({ response: result });
    });
    await source.click();
    await held.promise;
    await page.getByRole("button", { name: "Actions for Removal source" }).click();
    await page.getByRole("menuitem", { name: "Delete related target", exact: true }).click();
    await browserExpect(deleted).toHaveCount(0);
    release.resolve();
    await browserExpect(kept).toBeVisible();
    await browserExpect(deleted).toHaveCount(0);
    await browserExpect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Removal source");
    await page.unrouteAll({ behavior: "wait" });
    await page.getByText("Removal home", { exact: true }).first().click();
    await source.click();
    await browserExpect(kept).toBeVisible();
    await browserExpect(deleted).toHaveCount(0);
  } finally {
    release.resolve();
    await browser.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
