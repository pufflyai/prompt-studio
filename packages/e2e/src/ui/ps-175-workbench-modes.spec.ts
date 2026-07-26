import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, storyUrl } from "./mermaid-renderer-storybook";

const projectStoryId = "pstdio-workbench-examples--workbench-modes";
const workspaceStoryId = "pstdio-workbench-examples--workbench-modes-workspace";
const settingsStoryId = "pstdio-workbench-examples--workbench-modes-settings";

let storybook: ChildProcessWithoutNullStreams | undefined;
let storybookBaseUrl = "";

test.beforeAll(async () => {
  const started = await startStorybook(projectStoryId, "pstdio-workbench");
  storybook = started.storybook;
  storybookBaseUrl = started.baseUrl;
});

test.afterAll(() => {
  storybook?.kill();
});

test("PS-175 restores each mode frame without rebuilding project chrome", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storyUrl(storybookBaseUrl, projectStoryId));

  const activity = page.locator('[data-workbench-region="activity"]');
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const stableActivity = await activity.elementHandle();
  const stableSidenav = await sidenav.elementHandle();
  expect(stableActivity).not.toBeNull();
  expect(stableSidenav).not.toBeNull();

  await sidenav.getByRole("option", { name: "PS-267 Extension webviews", exact: true }).click();
  await expect(page.getByText("PS-267 Extension webviews", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Recent activity", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Switch to Workspace mode" }).click();
  await expect(page.getByText("Workspace mode", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("module.tsx", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Diff preview", { exact: true })).toBeVisible();
  await expect(page.locator('[data-workbench-panel="secondary"]')).toBeVisible();
  await expect(page.getByText("PS-267 Extension webviews", { exact: true })).toHaveCount(1);

  await page.getByRole("button", { name: "Switch to Settings mode" }).click();
  await expect(page.getByText("Workspace preferences", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-workbench-panel="secondary"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Switch to Project mode" }).click();
  await expect(page.getByText("PS-267 Extension webviews", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Recent activity", { exact: true })).toBeVisible();
  expect(await stableActivity!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await stableSidenav!.evaluate((element) => element.isConnected)).toBe(true);
});

test("PS-175 Storybook exposes every approved initial mode frame", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(storyUrl(storybookBaseUrl, workspaceStoryId));
  await expect(page.getByText("Workspace mode", { exact: true })).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
  await expect(page.getByText("Diff preview", { exact: true })).toBeVisible();

  await page.goto(storyUrl(storybookBaseUrl, settingsStoryId));
  await expect(page.getByText("Workspace preferences", { exact: true })).toBeVisible({
    timeout: STORY_RENDER_TIMEOUT_MS,
  });
  await expect(page.locator('[data-workbench-panel="secondary"]')).toHaveCount(0);
});
