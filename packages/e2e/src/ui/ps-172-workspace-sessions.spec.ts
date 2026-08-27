import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { showHiddenSidenavEntry } from "./helpers/sidenav-navigation";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, stopStorybook, storyUrl } from "./mermaid-renderer-storybook";

const workspaceResourceStoryId = "dashboard-sidenav--workspace-resource";
const sessionModeStoryId = "dashboard-sidenav--session-mode";
const ticketWorkspaceBackStoryId = "dashboard-sidenav--ticket-workspace-back-journey";

test.describe("PS-172 workspace sessions", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(workspaceResourceStoryId, "pstdio-dashboard"));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  test("keeps the workspace session list in the Sidenav and opens sessions in the Side Panel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, workspaceResourceStoryId));

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    await expect(sidenav).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
    const workspaceSessions = sidenav.locator('[data-tree-list-focus-id="workspace-sessions"]');
    await expect(workspaceSessions).toBeVisible();
    await expect(workspaceSessions).toHaveAttribute("aria-expanded", "true");
    await expect(sidenav.getByRole("option", { name: "Refactor sidenav", exact: true })).toBeVisible();
    await expect(sidenav.getByRole("option", { name: "Wire up board", exact: true })).toBeVisible();

    const workspacesNavigation = await showHiddenSidenavEntry(page, "Workspaces");
    await workspacesNavigation.click();
    const workspaceRow = page.getByRole("row").filter({ hasText: "Mode-driven sidenav" });
    await workspaceRow.getByRole("cell", { name: "Mode-driven sidenav", exact: true }).click();
    await expect(sidenav.getByRole("option", { name: "Refactor sidenav", exact: true })).toBeVisible();

    const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
    await sidenav.getByRole("option", { name: "Wire up board", exact: true }).click();

    const sidePanel = page.getByTestId("workbench-side-panel-floating");
    await expect(sidePanel).toBeVisible();
    await expect(sidePanel.getByText("Wire up board", { exact: true })).toBeVisible();
    await expect(breadcrumb.getByText("Mode-driven sidenav", { exact: true })).toBeVisible();
  });

  test("restores ticket sections after workspace Back and Forward navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, ticketWorkspaceBackStoryId));

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
    await expect(sidenav.getByRole("option", { name: "research.md", exact: true })).toBeVisible({
      timeout: STORY_RENDER_TIMEOUT_MS,
    });
    await expect(sidenav.getByRole("option", { name: "PS-164_A1", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Navigate forward" }).click();
    await expect(breadcrumb.getByText("PS-164_A1", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Navigate back" }).click();
    await expect(sidenav.getByRole("option", { name: "research.md", exact: true })).toBeVisible();
    await expect(sidenav.getByRole("option", { name: "PS-164_A1", exact: true })).toBeVisible();
  });

  test("creates a new session from the expanded Sessions group in sessions view", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, sessionModeStoryId));

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    await expect(sidenav).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
    const workspaceSessions = sidenav.locator('[data-tree-list-focus-id="workspace-sessions"]');
    await expect(workspaceSessions).toHaveAttribute("aria-expanded", "true");

    await workspaceSessions.hover();
    const createSession = sidenav.getByRole("button", { name: "New session" });
    await expect(createSession).toBeVisible();
    await createSession.click();

    await expect(
      page.getByRole("navigation", { name: "breadcrumb" }).getByText("New session", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("[data-testid='content-editable']")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
  });
});
