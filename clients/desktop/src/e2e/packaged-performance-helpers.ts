import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import type { PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";
import { createPackagedHome, launchPackagedApp } from "./packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "./packaged-project-helpers";

const fixturePath = dirname(fileURLToPath(import.meta.resolve("workbench-fixture/package.json")));
const performancePath = dirname(fileURLToPath(import.meta.resolve("pstdio-performance/package.json")));

export type { PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";

type MonitoringBridge = {
  promptStudioDesktop: { getPerformanceSnapshot: () => Promise<PerformanceSnapshot | null> };
};

// Prompt Studio Performance Monitoring measures exactly while it is loaded, so a test that
// measures with monitoring off launches without it.
export const launchProject = async (name: string, options: { monitoring?: boolean } = {}) => {
  const home = createPackagedHome();
  const app = await launchPackagedApp(home, {
    PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
      defaultExtensions: [
        { source: fixturePath, installName: "workbench-fixture", skipInstall: true },
        ...(options.monitoring
          ? [{ source: performancePath, installName: "pstdio-performance", skipInstall: true }]
          : []),
      ],
    }),
  });
  const project = await createPackagedProject(app, name);
  await openPackagedProject(app.page, project);
  await expect(app.page.getByTestId("start-page")).toBeVisible();
  if (options.monitoring) await expect.poll(async () => (await readSnapshot(app.page)) !== null).toBe(true);
  return { app, project };
};

export const readSnapshot = (page: Page) =>
  page.evaluate(() => (window as unknown as MonitoringBridge).promptStudioDesktop.getPerformanceSnapshot());

// The Performance extension's status meter and the details view it opens.
export const performanceMeter = (page: Page) =>
  page.frameLocator('iframe[title="Performance"]').getByTestId("performance-status-item");
export const performanceDetails = (page: Page) =>
  page.frameLocator('iframe[title="Performance details"]').getByTestId("performance-popover");

// Turns the device switch off directly, as a test fixture rather than a person.
export const stopMonitoring = async (page: Page) => {
  await page.evaluate(() =>
    (
      window as unknown as { promptStudioDesktop: { setPerformanceMonitoring: (on: boolean) => Promise<void> } }
    ).promptStudioDesktop.setPerformanceMonitoring(false),
  );
  await expect.poll(async () => readSnapshot(page)).toBeNull();
};

export const openLabPreview = async (page: Page) => {
  await page.getByRole("option", { name: "Lab", exact: true }).click();
  await expect(
    page.frameLocator('iframe[title="Lab"]').getByRole("heading", { name: "Sandbox webview" }),
  ).toBeVisible();
};
