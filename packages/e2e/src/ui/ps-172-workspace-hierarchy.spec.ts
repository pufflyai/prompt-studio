import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { rmSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createGitRepo, registerRepoViaApi } from "./helpers/workspace-session-attempt";
import { startStorybook, storyUrl } from "./mermaid-renderer-storybook";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const workspaceModeStoryId = "dashboard-sidenav--workspace-mode";
const headerNames = ["Search", "Notifications", "Sessions", "Workspaces", "Tickets"] as const;

interface Workspace {
  id: string;
  name: string;
  workspace_shorthand: string;
  worktree_path: string;
}

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-172 Hierarchy" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const createWorkspace = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  repoId: string,
) => {
  const response = await request.post(`${apiBase}/v1/workspaces`, {
    data: { project_id: projectId, repo_id: repoId },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as Workspace;
};

const createWorkspaceSession = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  workspaceId: string,
) => {
  const response = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      project_id: projectId,
      workspace_id: workspaceId,
      title: "Workspace hierarchy session",
      prompt: "Validate workspace hierarchy navigation",
      agent: "pstdio.extension-lab.fake",
    },
  });
  expect(response.ok()).toBe(true);
};

const prepareDashboard = async (page: Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
  await page.setViewportSize({ width: 1280, height: 720 });
};

const headerRow = (sidenav: Locator, name: (typeof headerNames)[number]) =>
  name === "Workspaces" || name === "Notifications"
    ? sidenav.getByRole("option", { name: new RegExp(`^${name}(?:\\s|$)`) }).first()
    : sidenav.getByRole("option", { name, exact: true }).first();

const expectWorkspaceBreadcrumb = async (page: Page, workspaceLabel: string, child: string | RegExp) => {
  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
  await expect(breadcrumb.getByText("Workspaces", { exact: true })).toBeVisible();
  await expect(breadcrumb.getByText(workspaceLabel, { exact: true })).toBeVisible();
  await expect(breadcrumb.getByText(child, { exact: true })).toBeVisible();
};

test("PS-172 navigates canonical workspace children without rebuilding the Sidenav header", async ({
  page,
  request,
}) => {
  test.setTimeout(45_000);
  const project = await createProject(request);
  const repoRoot = createGitRepo("pstdio-e2e-ps172-", "PS-172 workspace files");

  try {
    const repo = await registerRepoViaApi(request, apiBase, project.id, "ps-172-repo", repoRoot);
    const workspace = await createWorkspace(request, project.id, repo.id);
    await createWorkspaceSession(request, project.id, workspace.id);
    await prepareDashboard(page, project.id);
    await page.goto("/");

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    const projectButton = sidenav.getByRole("button", { name: /PS-172 Hierarchy$/ });
    await expect(projectButton).toBeVisible({ timeout: 30_000 });
    const stableHeader = [await projectButton.elementHandle()];
    for (const name of headerNames) stableHeader.push(await headerRow(sidenav, name).elementHandle());
    expect(stableHeader.every(Boolean)).toBe(true);

    await headerRow(sidenav, "Workspaces").click();
    const workspaceRow = page
      .getByRole("option", { name: new RegExp(`^${workspace.workspace_shorthand}(?:\\s|$)`) })
      .first();
    await expect(workspaceRow).toBeVisible({ timeout: 15_000 });
    await workspaceRow.click();

    const heading = sidenav.getByRole("option", { name: workspace.name, exact: true });
    const files = sidenav.getByRole("option", { name: "Files", exact: true });
    const diff = sidenav.getByRole("option", { name: /^Diff(?: · \d+ changed)?$/ });
    const sessions = sidenav.getByRole("option", { name: "Sessions · 1", exact: true });
    await expect(heading).toHaveCount(1);
    await expect(files).toHaveCount(1);
    await expect(diff).toHaveCount(1);
    await expect(sessions).toHaveCount(1);
    await expect(diff).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("diff-viewer")).toBeVisible();

    await files.click();
    await expect(files).toHaveAttribute("aria-selected", "true");
    await expectWorkspaceBreadcrumb(page, workspace.name, "Files");
    await expect(
      page.getByRole("list", { name: "Workspace files" }).getByRole("option", { name: "README.md" }),
    ).toBeVisible();

    await diff.click();
    await expect(diff).toHaveAttribute("aria-selected", "true");
    await expectWorkspaceBreadcrumb(page, workspace.name, /^Diff(?: · \d+ changed)?$/);
    await expect(page.getByTestId("diff-viewer")).toBeVisible();

    await sessions.click();
    await expect(sessions).toHaveAttribute("aria-selected", "true");
    await expectWorkspaceBreadcrumb(page, workspace.name, "Sessions · 1");
    await expect(
      page.getByRole("list", { name: "Workspace sessions" }).getByRole("option", {
        name: /Workspace hierarchy session/,
      }),
    ).toBeVisible();

    for (const element of stableHeader) expect(await element!.evaluate((node) => node.isConnected)).toBe(true);

    await headerRow(sidenav, "Workspaces").click();
    await expect(files).toHaveCount(0);
    await expect(diff).toHaveCount(0);
    await expect(sessions).toHaveCount(0);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test.describe("PS-172 workspace Sidenav story", () => {
  test.slow();
  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(workspaceModeStoryId, "pstdio-dashboard"));
  });

  test.afterAll(() => storybook?.kill());

  test("matches the F16 workspace hierarchy", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, workspaceModeStoryId));

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    await expect(sidenav.getByRole("button", { name: /Prompt Studio$/ })).toBeVisible({ timeout: 30_000 });
    await expect(sidenav.getByRole("option", { name: "Mode-driven sidenav", exact: true })).toHaveCount(1);
    await expect(sidenav.getByRole("option", { name: "Files", exact: true })).toHaveCount(1);
    const diff = sidenav.getByRole("option", { name: /^Diff(?: · \d+ changed)?$/ });
    await expect(diff).toHaveCount(1);
    await expect(diff).toHaveAttribute("aria-selected", "true");
    await expect(sidenav.getByRole("option", { name: "Sessions · 2", exact: true })).toHaveCount(1);
  });
});
