import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import type { PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";
import { createPackagedHome, launchPackagedApp } from "./packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "./packaged-project-helpers";

const fixturePath = dirname(fileURLToPath(import.meta.resolve("workbench-fixture/package.json")));
const homePath = dirname(fileURLToPath(import.meta.resolve("home/package.json")));
const performancePath = dirname(fileURLToPath(import.meta.resolve("performance/package.json")));
const sessionsPath = dirname(fileURLToPath(import.meta.resolve("session-browser/refs")));
const preparedSources = JSON.parse(process.env.E2E_EXTENSION_SOURCES ?? "{}") as Record<string, string>;
const benchmarkExtension = (installName: string, fallback: string) => ({
  installName,
  source: preparedSources[installName] ?? fallback,
  // Installed public fixture profiles take the same normal provisioning path as real extensions.
  ...(preparedSources[installName] ? {} : { skipInstall: true }),
});

export type { PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";

type MonitoringBridge = {
  promptStudioDesktop: { getPerformanceSnapshot: () => Promise<PerformanceSnapshot | null> };
};

// Prompt Studio Performance Monitoring measures exactly while it is loaded, so a test that
// measures with monitoring off launches without it.
export const launchProject = async (
  name: string,
  options: { monitoring?: boolean; webview?: boolean; harness?: boolean } = {},
) => {
  const home = createPackagedHome();
  const app = await launchPackagedApp(home, {
    PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
      defaultExtensions: [
        ...(options.harness ? [benchmarkExtension("workbench-fixture", fixturePath)] : []),
        ...(options.webview
          ? [{ source: join(fixturePath, "fixtures/webview-host"), installName: "webview-host" }]
          : []),
        benchmarkExtension("pstdio-home", homePath),
        benchmarkExtension("pstdio-session-browser", sessionsPath),
        ...(options.monitoring ? [benchmarkExtension("pstdio-performance", performancePath)] : []),
      ],
    }),
  });
  const project = await createPackagedProject(app, name);
  await openPackagedProject(app.page, project);
  await expect(homePage(app.page)).toBeVisible();
  if (options.monitoring) await expect.poll(async () => (await readSnapshot(app.page)) !== null).toBe(true);
  return { app, project };
};

export const homePage = (page: Page) => page.frameLocator('iframe[title="Home"]').getByTestId("start-page");

export const readSnapshot = (page: Page) =>
  page.evaluate(() => (window as unknown as MonitoringBridge).promptStudioDesktop.getPerformanceSnapshot());

// The Performance extension's status meter and the details view it opens.
export const performanceMeter = (page: Page) =>
  page.frameLocator('iframe[title="Performance"]:visible').getByTestId("performance-status-item");
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

export const openHostPreview = async (page: Page) => {
  const destination = new URL(page.url());
  destination.pathname = `/projects/${destination.pathname.split("/")[2]}/extensions/test.webview-host/host`;
  await page.goto(destination.href);
  await expect(
    page.frameLocator('iframe[title="Host page"]').getByRole("heading", { name: "Host contract" }),
  ).toBeVisible();
};
