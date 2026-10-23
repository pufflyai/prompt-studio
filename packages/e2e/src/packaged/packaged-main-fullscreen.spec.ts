import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, test } from "@playwright/test";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test("packaged Main fullscreen exits with Escape and resets on reload", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-main-fullscreen-"));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    const started = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture") });
    child = started.child;
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Packaged fullscreen" }, root)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, started.descriptor);
    await page.goto(`${started.baseUrl}/projects/${project.id}/`);
    const enter = page.getByRole("button", { name: "Enter Main fullscreen", exact: true });
    await enter.click();
    await expect(page.getByRole("button", { name: "Exit Main fullscreen", exact: true })).toBeVisible();
    const bubble = page.getByRole("button", { name: "Open Side Panel", exact: true });
    await expect(bubble).toBeVisible();
    await bubble.click();
    await expect(page.getByRole("dialog", { name: "Side Panel", exact: true })).toBeVisible();
    await expect(bubble).toBeHidden();
    await page.getByRole("button", { name: "Close Side Panel", exact: true }).click();
    await expect(bubble).toBeVisible();
    await expect(bubble).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Side Panel", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close Side Panel", exact: true }).click();
    await expect(bubble).toBeVisible();
    await page.getByText("Project home", { exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(enter).toBeFocused();
    await enter.click();
    await page.reload();
    await expect(enter).toBeVisible();
    await page.goto(`${started.baseUrl}/projects/${project.id}/extensions/pstdio.workbench-fixture/lab`);
    const guest = page.frameLocator('iframe[title="Lab"]');
    await expect(guest.getByRole("heading", { name: "Sandbox webview", exact: true })).toBeVisible();
    await guest.locator("body").press("Alt+Shift+Space");
    await expect(page.getByRole("dialog", { name: "Keyboard menu", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Keyboard menu", exact: true })).toBeHidden();
    await expect(page.locator('iframe[title="Lab"]')).toBeFocused();
    await enter.click();
    await guest.locator("body").press("Escape");
    await expect(enter).toBeVisible();
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
