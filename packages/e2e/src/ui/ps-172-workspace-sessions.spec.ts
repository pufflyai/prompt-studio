import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, storyUrl } from "./mermaid-renderer-storybook";

const workspaceModeStoryId = "dashboard-sidenav--workspace-mode";
const sessionModeStoryId = "dashboard-sidenav--session-mode";

test.describe("PS-172 workspace sessions", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(workspaceModeStoryId, "pstdio-dashboard"));
  });

  test.afterAll(() => {
    storybook?.kill();
  });

  test("keeps the workspace session list in the Sidenav and opens sessions in the Side Panel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, workspaceModeStoryId));

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    await expect(sidenav).toBeVisible({ timeout: 15_000 });
    const workspaceSessions = sidenav.locator('[data-tree-list-focus-id="sessions"]');
    await expect(workspaceSessions).toBeVisible();
    await expect(workspaceSessions).toHaveAttribute("aria-expanded", "true");
    await expect(sidenav.getByRole("option", { name: "Refactor sidenav", exact: true })).toBeVisible();
    await expect(sidenav.getByRole("option", { name: "Wire up board", exact: true })).toBeVisible();

    await sidenav
      .getByRole("option", { name: /^Workspaces/ })
      .first()
      .click();
    await page.getByRole("option", { name: /^Mode-driven sidenav/ }).click();
    await expect(sidenav.getByRole("option", { name: "Refactor sidenav", exact: true })).toBeVisible();

    const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
    await sidenav.getByRole("option", { name: "Wire up board", exact: true }).click();

    const sidePanel = page.getByTestId("workbench-session-bubble");
    await expect(sidePanel).toBeVisible();
    await expect(sidePanel.getByText("Wire up board", { exact: true })).toBeVisible();
    await expect(breadcrumb.getByText("Mode-driven sidenav", { exact: true })).toBeVisible();
  });

  test("creates a new session from the expanded Sessions group in sessions view", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, sessionModeStoryId));

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    await expect(sidenav).toBeVisible({ timeout: 15_000 });
    const workspaceSessions = sidenav.locator('[data-tree-list-focus-id="sessions"]');
    await expect(workspaceSessions).toHaveAttribute("aria-expanded", "true");

    await workspaceSessions.hover();
    const createSession = sidenav.getByRole("button", { name: "New session" });
    await expect(createSession).toBeVisible();
    await createSession.click();

    await expect(
      page.getByRole("navigation", { name: "breadcrumb" }).getByText("New session", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("No messages yet", { exact: true })).toBeVisible();
  });
});
