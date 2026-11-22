import { rmSync } from "node:fs";
import { folderProjectInput } from "../helpers/folder-project";
import { homeFrame } from "../helpers/home-loading";
import { createPlannerTicket } from "../helpers/planner-api";
import { expect, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";
import { createGitRepo } from "./helpers/workspace-session-attempt";

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    if (window.parent !== window) return;
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
  }, projectId);
};

const createProjectViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  name: string,
  folderPath?: string,
) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name }, folderPath),
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const createWorkspaceViaApi = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const res = await request.post(`${apiBase}/v1/workspaces`, {
    data: { project_id: projectId, provider_id: "pstdio.worktree", params: {} },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; workspace_shorthand: string };
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  expect(res.ok()).toBe(true);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    const del = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(del.ok()).toBe(true);
  }
};

test.describe("Session bubble workspace selection", () => {
  let projectId: string;
  const repoDirs: string[] = [];

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
  });

  test.afterEach(async ({ request }) => {
    try {
      const response = await request.delete(`${apiBase}/v1/projects/${projectId}`);
      expect(response.ok()).toBe(true);
    } finally {
      for (const dir of repoDirs) {
        rmSync(dir, { recursive: true, force: true });
      }
      repoDirs.length = 0;
    }
  });

  test("changes the draft workspace without opening the workspace", async ({ page, request }) => {
    const repoRoot = createGitRepo("pstdio-e2e-session-bubble-repo-", "session bubble workspace selection");
    repoDirs.push(repoRoot);
    projectId = (await createProjectViaApi(request, "Session Bubble Workspace Test Project", repoRoot)).id;
    await bypassOnboarding(page, projectId);

    const workspace = await createWorkspaceViaApi(request, projectId);
    const available = await (await request.get(`${apiBase}/v1/workspaces?project_id=${projectId}`)).json();
    const current = available.find((item: { isDefault: boolean }) => item.isDefault);
    expect(current).toBeTruthy();
    const ticket = await createPlannerTicket(request, apiBase, projectId, {
      content: "Choose a session workspace",
    });

    await page.goto(`/projects/${projectId}`);
    await page.getByRole("option", { name: "Tickets", exact: true }).click();
    await page.getByText(ticket.content, { exact: true }).click();
    await expect(page).toHaveURL(/\/extensions\/pstdio\.planner\/ticket\?resource=/);
    const ticketUrl = page.url();

    await page.getByRole("group", { name: "Panel controls" }).getByRole("button", { name: "Show Side Panel" }).click();
    await page.locator('[data-workbench-panel-header="side"]').getByRole("button", { name: "Add panel" }).click();
    await page.getByRole("menuitem", { name: "New session", exact: true }).click();
    const sidePanel = page.getByTestId("workbench-side-panel-attached");
    await expect(sidePanel).toBeVisible();

    // Shared Main menu parity: selecting an existing draft workspace never exposes navigation or creation.
    await expect(sidePanel.getByRole("button", { name: "Open workspace", exact: true })).toHaveCount(0);
    await expect(sidePanel.getByRole("button", { name: "Select device", exact: true })).toHaveCount(0);
    await sidePanel.getByRole("button", { name: "Select workspace", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "New workspace", exact: true })).toHaveCount(0);
    await page.getByRole("menuitem", { name: workspace.workspace_shorthand, exact: true }).click();

    await expect(sidePanel.getByRole("button", { name: "Open workspace", exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(ticketUrl);
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).not.toContainText(workspace.workspace_shorthand);
    await expect(sidePanel.getByRole("button", { name: "Select workspace", exact: true })).toContainText(
      workspace.workspace_shorthand,
    );
  });

  // Critical risk: launcher customization must keep the Side Panel reachable and
  // must not open a session merely because the person drags the bubble.
  test("remembers the bubble position, visibility, and default panel", async ({ page, request }) => {
    projectId = (await createProjectViaApi(request, "Custom Side Panel bubble")).id;
    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}`);
    await expect(homeFrame(page).getByText("Custom Side Panel bubble", { exact: true })).toBeVisible();
    const bubble = page.getByRole("button", { name: "Open Side Panel", exact: true });
    await expect(bubble).toBeVisible();
    await bubble.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Align center", exact: true }).click();
    await expect(bubble).toHaveAttribute("data-side-panel-bubble-alignment", "center");
    const bounds = await bubble.boundingBox();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await page.mouse.down();
    await page.mouse.move(32, bounds!.y + bounds!.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(bubble).toHaveAttribute("data-side-panel-bubble-alignment", "left");
    await expect(page.getByTestId("workbench-side-panel-floating")).toBeHidden();
    await bubble.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Default panel", exact: true }).hover();
    await page.getByRole("menuitem", { name: "Side Panel", exact: true }).click();
    await page.reload();
    await expect(homeFrame(page).getByText("Custom Side Panel bubble", { exact: true })).toBeVisible();
    await expect(bubble).toHaveAttribute("data-side-panel-bubble-alignment", "left");
    await bubble.click();
    const side = page.getByTestId("workbench-side-panel-floating");
    await expect(side).toBeVisible();
    await expect(side.getByTestId("content-editable").filter({ visible: true })).toHaveCount(0);
    await side.getByRole("button", { name: "Close Side Panel", exact: true }).click();
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    await page.getByRole("option", { name: "Appearance", exact: true }).click();
    const toggle = page.getByRole("checkbox", { name: "Show Side Panel bubble", exact: true });
    await expect(toggle).toBeChecked();
    await page.locator("label").filter({ has: toggle }).click();
    await expect(toggle).not.toBeChecked();
    await expect(page.locator("[data-side-panel-bubble-alignment]")).toHaveCount(0);
    await page.locator("label").filter({ has: toggle }).click();
    await expect(toggle).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveAttribute("data-side-panel-bubble-alignment", "left");
    await bubble.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Default panel", exact: true }).hover();
    await expect(page.getByRole("menuitem", { name: "Default (New session)", exact: true })).toBeVisible();
    await page.getByRole("menuitem", { name: "New session", exact: true }).click();
    await bubble.click();
    await expect(side.getByTestId("content-editable").filter({ visible: true })).toBeVisible();
    await side.getByRole("button", { name: "Close Side Panel", exact: true }).click();
    const listed = await (await request.get(`${apiBase}/v1/projects/${projectId}/extensions`)).json();
    const sessions = listed.extensions.find(
      (entry: { installName: string }) => entry.installName === "session-browser",
    );
    expect(sessions).toBeTruthy();
    const disabled = await request.patch(`${apiBase}/v1/projects/${projectId}/extensions/${sessions.id}`, {
      data: { enabled: false },
    });
    expect(disabled.ok()).toBe(true);
    await expect(page.getByRole("option", { name: "Sessions", exact: true })).toHaveCount(0);
    await bubble.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Default panel", exact: true }).hover();
    await expect(page.getByRole("menuitem", { name: "Default (New session)", exact: true })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "New session", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await bubble.click();
    await expect(side).toBeVisible();
    await expect(side.getByTestId("content-editable").filter({ visible: true })).toHaveCount(0);
  });
});
