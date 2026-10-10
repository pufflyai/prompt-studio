import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { createPackagedHome, launchPackagedApp } from "./packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "./packaged-project-helpers";

const fixturePath = dirname(fileURLToPath(import.meta.resolve("workbench-fixture/package.json")));

export type PerformanceSnapshot = {
  processes: Array<{
    pid: number;
    role: string;
    cpuPercent: number;
    extensionFrames: Array<{ installedExtensionId: string }>;
  }>;
  frames: unknown[];
  pausedExtensionIds: string[];
};
type MonitoringBridge = {
  promptStudioDesktop: { getPerformanceSnapshot: () => Promise<PerformanceSnapshot | null> };
};

export const launchProject = async (name: string) => {
  const home = createPackagedHome();
  const app = await launchPackagedApp(home, {
    PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
      defaultExtensions: [{ source: fixturePath, installName: "workbench-fixture", skipInstall: true }],
    }),
  });
  const project = await createPackagedProject(app, name);
  await openPackagedProject(app.page, project);
  await expect(app.page.getByTestId("start-page")).toBeVisible();
  return { app, project };
};

export const readSnapshot = (page: Page) =>
  page.evaluate(() => (window as unknown as MonitoringBridge).promptStudioDesktop.getPerformanceSnapshot());

// Uses the Settings switch, so the dashboard starts its slow-frame observer too.
export const setMonitoring = async (page: Page, enabled: boolean) => {
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .filter({ hasText: "Developer tools" })
    .getByText("Performance", { exact: true })
    .click();
  const toggle = page.getByRole("checkbox", { name: "Enable performance monitoring", exact: true });
  await page.locator("label").filter({ has: toggle }).click();
  await expect(toggle).toBeChecked({ checked: enabled });
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await readSnapshot(page)) !== null).toBe(enabled);
};

export const openLabPreview = async (page: Page) => {
  await page.getByRole("option", { name: "Lab", exact: true }).click();
  await expect(
    page.frameLocator('iframe[title="Lab"]').getByRole("heading", { name: "Sandbox webview" }),
  ).toBeVisible();
};
