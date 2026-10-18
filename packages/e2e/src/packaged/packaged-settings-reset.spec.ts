import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { writeWebviewSettingsExtension } from "../helpers/webview-settings-extension";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test("typed webview settings delete restores the fallback across reloads", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-settings-reset-"));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    writeWebviewSettingsExtension(root);
    const started = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: "[]",
      PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1",
    });
    child = started.child;
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Settings reset" }, root)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, started.descriptor);
    await page.goto(`${started.baseUrl}/projects/${project.id}/extensions/test.settings-fixture/settings`);
    const frame = page.frameLocator('iframe[title="Settings fixture"]');
    await expect(frame.locator("output")).toHaveText("comfortable");
    await frame.getByRole("button", { name: "Use compact", exact: true }).click();
    await expect(frame.locator("output")).toHaveText("compact");
    await page.reload();
    await expect(frame.locator("output")).toHaveText("compact");
    await frame.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(frame.locator("output")).toHaveText("comfortable");
    await page.reload();
    await expect(frame.locator("output")).toHaveText("comfortable");
    await page.screenshot({ path: test.info().outputPath("settings-reset.png") });
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
