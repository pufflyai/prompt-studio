import { expect, type Page } from "@playwright/test";
import { parseExtensionWebviewPath } from "pstdio-api-contracts/extension-host";
import { test } from "../testing/packaged-fixture";
import { disposePackagedApp, type PackagedApp } from "./packaged-app-helpers";
import {
  launchProject,
  openHostPreview,
  type PerformanceSnapshot,
  performanceDetails,
  performanceTrigger,
  readSnapshot,
} from "./packaged-performance-helpers";
import { observePauseInput, pauseInputEvidence } from "./performance-pause-input.diagnostic";

// Every distinct number of popover rows for extension `key` seen while sampling for `ms`.
const rowCountsWhile = async (page: Page, key: string, ms: number) => {
  const details = page.frames().find((frame) => frame.url().includes("details"));
  if (!details) throw new Error("The performance details view is not open");
  return details.evaluate(
    async ({ key, ms }) => {
      const seen = new Set<number>();
      const end = performance.now() + ms;
      while (performance.now() < end) {
        seen.add(document.querySelectorAll(`[data-testid="performance-cpu-row"][data-key="${key}"]`).length);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return [...seen].sort();
    },
    { key, ms },
  );
};

export const runPauseCase = async () => {
  if (process.platform === "linux") test.setTimeout(40_000);
  let app: PackagedApp | null = null;
  let diagnosticTarget: string | undefined;
  try {
    ({ app } = await launchProject("Extension processes", { monitoring: true, webview: true }));
    const processes = async () => (await readSnapshot(app!.page))?.processes ?? [];
    const extensionProcesses = async () =>
      (await processes()).filter((process) => process.role === "extension-frames" && process.extensionFrames.length);
    const hostedIds = (process: PerformanceSnapshot["processes"][number]) =>
      new Set(process.extensionFrames.map((frame) => frame.installedExtensionId));

    await openHostPreview(app.page);
    const source = await app.page
      .frameLocator('iframe[title="Host page"]')
      .locator("html")
      .evaluate(() => location.pathname);
    const scope = parseExtensionWebviewPath(source)?.scope;
    expect(scope).toBeDefined();
    const fixtureId = scope!.installedExtensionId;
    diagnosticTarget = fixtureId;
    await observePauseInput(app.page, fixtureId);
    await expect
      .poll(async () => (await extensionProcesses()).some((process) => hostedIds(process).has(fixtureId)))
      .toBe(true);
    const fixtureProcess = (await extensionProcesses()).find((process) => hostedIds(process).has(fixtureId))!;
    const workbench = (await processes()).find((process) => process.role === "workbench");
    expect(fixtureProcess.pid).not.toBe(workbench?.pid);

    await expect(app.page.locator('iframe[title="Host page"]')).toHaveCount(1);
    await performanceTrigger(app.page).click();
    // Each extension has its own row, named from its webview ids, even in a shared process.
    const row = performanceDetails(app.page).getByTestId("performance-cpu-row").filter({ hasText: "webview-host" });
    await expect(row).toBeVisible();
    // Closing the popover must retain its loaded webview for the next opening.
    const detailsFrame = app.page.locator('iframe[title="Performance details"]');
    const loadedFrame = await detailsFrame.elementHandle();
    await performanceTrigger(app.page).click();
    await expect(detailsFrame).toBeHidden();
    expect(await loadedFrame!.evaluate((frame) => frame.isConnected)).toBe(true);
    await performanceTrigger(app.page).click();
    await expect(row).toBeVisible();
    expect(await detailsFrame.evaluate((frame, original) => frame === original, loadedFrame)).toBe(true);
    const pause = row.getByRole("button", { name: "Pause webview-host", exact: true });
    // Enter the live CPU list before clicking: pointer entry freezes its order,
    // which can otherwise move the target between Playwright's stability check and input.
    await pause.hover();
    // Pausing and resuming must never show the extension twice or drop its row.
    let rows = rowCountsWhile(app.page, fixtureId, 4_000);
    await pause.click();
    expect(await rows).toEqual([1]);
    await expect(app.page.locator('iframe[title="Host page"]')).toHaveCount(0);
    await expect.poll(async () => (await readSnapshot(app!.page))?.pausedExtensionIds).toEqual([fixtureId]);
    await expect.poll(async () => (await processes()).some((process) => hostedIds(process).has(fixtureId))).toBe(false);

    // A paused row keeps the name it had while its views ran.
    const resume = row.getByRole("button", { name: "Resume webview-host", exact: true });
    await resume.hover();
    rows = rowCountsWhile(app.page, fixtureId, 4_000);
    await resume.click();
    expect(await rows).toEqual([1]);
    await expect(app.page.locator('iframe[title="Host page"]')).toHaveCount(1);
  } finally {
    try {
      if (app && diagnosticTarget)
        await test.info().attach("pause-input-diagnostic", {
          body: JSON.stringify(await pauseInputEvidence(app.page, diagnosticTarget), null, 2),
          contentType: "application/json",
        });
    } finally {
      await disposePackagedApp(app);
    }
  }
};
