import { expect as expectBun, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { expectPackagedStatusBarOrder } from "./packaged-status-bar-order";

// Hosted Intel macOS runners took 22-26 s to pass this test and timed out at 30 s on 2026-10-10:
// it starts the runtime, installs an extension, and loads the dashboard three times in Chromium.
// The user approved 60 s on Intel on 2026-10-10; other platforms keep 30 s.
const timeoutMs = process.platform === "darwin" && process.arch === "x64" ? 60_000 : 30_000;

const expectPackagedConnectionStatus = async (baseUrl: string, headers: Record<string, string>) => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ extraHTTPHeaders: headers });
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(baseUrl);
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    await page.getByText("Connection", { exact: true }).click();
    const toggle = page.getByRole("checkbox", { name: "Show connection status" });
    await expect(toggle).not.toBeChecked();
    await toggle.focus();
    await toggle.press("Space");
    await expect(toggle).toBeChecked();
    const connected = page.getByRole("status", { name: /connected to backend/i, includeHidden: true });
    await expect(connected).toBeVisible();
    await expect(connected).toHaveText("");
    await expect(connected).toHaveCSS("border-top-width", "0px");
    await expect(connected).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(connected.locator("svg")).toHaveCSS("width", "6px");
    await page.reload();
    await expect(toggle).toBeChecked();
    await expect(connected).toBeVisible();
    await expectPackagedStatusBarOrder(page);
    const statusBar = page.locator("[data-workbench-region='status']");
    const barBounds = await statusBar.boundingBox();
    const dotBounds = await connected.locator("svg").boundingBox();
    if (!barBounds || !dotBounds) throw new Error("The connection dot and status bar must be visible.");
    expect(Math.abs(dotBounds.y + dotBounds.height / 2 - barBounds.y - barBounds.height / 2)).toBeLessThan(1);
    expect(barBounds.x + barBounds.width - dotBounds.x - dotBounds.width).toBeGreaterThanOrEqual(12);
    await page.context().setOffline(true);
    await page.evaluate(() => window.stop());
    const warning = page.getByRole("status", { name: /backend connection lost/i, includeHidden: true });
    await expect(warning).toBeVisible();
    await expect(warning).not.toHaveText("");
    await toggle.focus();
    await toggle.press("Space");
    await expect(warning).not.toBeVisible();
    await toggle.press("Space");
    await expect(warning).toBeVisible();
    await page.getByRole("button", { name: "Close Connection", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await warning.focus();
    await expect(
      page.getByRole("tooltip", { name: (await warning.getAttribute("aria-label")) ?? "", exact: true }),
    ).toBeVisible();
    await page.context().setOffline(false);
    await page.reload();
    await expect(connected).toBeVisible();
    await connected.hover();
    await expect(
      page.getByRole("tooltip", { name: (await connected.getAttribute("aria-label")) ?? "", exact: true }),
    ).toBeVisible();
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    await page.getByText("Connection", { exact: true }).click();
    await toggle.focus();
    await toggle.press("Space");
    await expect(connected).not.toBeVisible();
    await page.reload();
    await expect(toggle).not.toBeChecked();
  } finally {
    await browser.close();
  }
};

export const registerConnectionStatusSmokeTests = () => {
  test(
    "persists connection status settings and reports backend disconnection",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-connection-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot, {
          PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture"),
        });
        child = started.child;
        const folder = join(tempRoot, "connection-project");
        mkdirSync(folder);
        const project = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "Content-Type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name: "Connection status" }, folder)),
        });
        expectBun(project.ok).toBe(true);
        await expectPackagedConnectionStatus(started.baseUrl, runtimeAuthorization(started.descriptor));
      } finally {
        if (child) await stopProcess(child);
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    timeoutMs,
  );
};
