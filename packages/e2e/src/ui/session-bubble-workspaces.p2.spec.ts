import { rmSync } from "node:fs";
import { folderProjectInput } from "../helpers/folder-project";
import { homeFrame } from "../helpers/home-loading";
import { createPlannerTicket } from "../helpers/planner-api";
import { expect, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";
import { verifyFreeFloatingSidePanel } from "./helpers/floating-side-panel";
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

const verifyMovableSidePanel = async (
  page: import("@playwright/test").Page,
  projectId: string,
  info: import("@playwright/test").TestInfo,
) => {
  await bypassOnboarding(page, projectId);
  await page.goto(`/projects/${projectId}`);
  await expect(homeFrame(page).getByText("Movable Side Panel", { exact: true })).toBeVisible();
  const bubble = page.getByRole("button", { name: "Open Side Panel", exact: true });
  const targets = page.locator("[data-side-panel-drop-slot]");
  await expect(targets).toHaveCount(0);
  const viewport = page.viewportSize()!;
  const centerX = async (locator: import("@playwright/test").Locator) => {
    const bounds = (await locator.boundingBox())!;
    return bounds.x + bounds.width / 2;
  };
  await bubble.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Align center", exact: true }).click();
  await expect.poll(() => centerX(bubble)).toBeCloseTo(viewport.width / 2, 0);
  const bounds = (await bubble.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 - 8, bounds.y + bounds.height / 2, { steps: 3 });
  await expect.poll(() => centerX(bubble)).toBeLessThan(viewport.width / 2 - 4);
  await expect(targets).toHaveCount(3);
  for (const slot of ["left", "center", "right"])
    await expect(page.locator(`[data-side-panel-drop-slot="${slot}"]`)).toBeVisible();
  await expect(page.locator('[data-side-panel-drop-slot="center"]')).toHaveAttribute("data-drop-active", "true");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(targets).toHaveCount(0);
  await expect(page.getByTestId("workbench-side-panel-floating")).toBeHidden();
  await expect.poll(() => centerX(bubble)).toBeCloseTo(viewport.width / 2, 0);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(40, bounds.y + bounds.height / 2, { steps: 8 });
  await expect(page.locator('[data-side-panel-drop-slot="left"]')).toHaveAttribute("data-drop-active", "true");
  await page.screenshot({ path: info.outputPath("bubble-drop-targets.png") });
  await page.mouse.up();
  await expect(targets).toHaveCount(0);
  await expect.poll(() => centerX(bubble)).toBeLessThan(viewport.width / 3);
  await bubble.click();
  const side = page.getByTestId("workbench-side-panel-floating");
  await expect(side).toBeVisible();
  await expect.poll(() => centerX(side)).toBeLessThan(viewport.width / 3);
  const draft = side.getByTestId("content-editable").filter({ visible: true });
  await draft.fill("Keep this draft while moving the panel");
  const header = (await side.locator('[data-workbench-panel-header="side"]').boundingBox())!;
  await page.mouse.move(header.x + header.width * 0.65, header.y + header.height / 2);
  await page.mouse.down();
  await page.mouse.move((viewport.width * 2) / 3 + 15, header.y + header.height / 2, { steps: 8 });
  await expect(page.locator('[data-side-panel-drop-slot="right"]')).toHaveAttribute("data-drop-active", "true");
  await page.screenshot({ path: info.outputPath("panel-drop-targets.png") });
  await page.mouse.move(viewport.width - 40, header.y + header.height / 2, { steps: 8 });
  await expect(targets).toHaveCount(3);
  await expect(page.locator('[data-side-panel-drop-slot="right"]')).toHaveAttribute("data-drop-active", "true");
  await page.mouse.up();
  await expect(targets).toHaveCount(0);
  await expect.poll(() => centerX(side)).toBeGreaterThan((viewport.width * 2) / 3);
  await expect(draft).toContainText("Keep this draft while moving the panel");
  await side.getByRole("button", { name: "Close Side Panel", exact: true }).click();
  await expect.poll(() => centerX(bubble)).toBeGreaterThan((viewport.width * 2) / 3);
  await bubble.click();
  await side.locator('[data-workbench-panel-header="side"]').click({
    button: "right",
    position: { x: header.width * 0.65, y: header.height / 2 },
  });
  await page.getByRole("menuitem", { name: "Align center", exact: true }).click();
  await expect.poll(() => centerX(side)).toBeCloseTo(viewport.width / 2, 0);
  await expect(draft).toContainText("Keep this draft while moving the panel");
  await side.getByRole("button", { name: "Close Side Panel", exact: true }).click();
  await expect.poll(() => centerX(bubble)).toBeCloseTo(viewport.width / 2, 0);
  await page.reload();
  await expect(homeFrame(page).getByText("Movable Side Panel", { exact: true })).toBeVisible();
  await expect.poll(() => centerX(bubble)).toBeCloseTo(viewport.width / 2, 0);
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

  // Critical risk: both launchers must move visually, including over a live Side iframe.
  test("moves the bubble and floating panel to the chosen position", async ({ page, request }, info) => {
    projectId = (await createProjectViaApi(request, "Movable Side Panel")).id;
    await verifyMovableSidePanel(page, projectId, info);
  });

  test("freely moves and resizes the floating panel without losing its content", async ({ page, request }, info) => {
    projectId = (await createProjectViaApi(request, "Free floating Side Panel")).id;
    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}`);
    await expect(homeFrame(page).getByText("Free floating Side Panel", { exact: true })).toBeVisible();
    await verifyFreeFloatingSidePanel(page, info);
  });

  // Critical risk: choosing a default must work with existing tabs and preserve their drafts.
  test("changes the default panel in Appearance without clearing Side tabs", async ({ page, request }) => {
    projectId = (await createProjectViaApi(request, "Side Panel defaults")).id;
    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}`);
    await expect(homeFrame(page).getByText("Side Panel defaults", { exact: true })).toBeVisible();
    const bubble = page.getByRole("button", { name: "Open Side Panel", exact: true });
    const side = page.getByTestId("workbench-side-panel-floating");
    await bubble.click();
    await side.getByTestId("content-editable").filter({ visible: true }).fill("Retain the existing draft");
    await side.getByRole("button", { name: "Close Side Panel", exact: true }).click();
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    await page.getByRole("option", { name: "Appearance", exact: true }).click();
    await expect(page.getByText("Default Side Panel", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Default (New session)", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Tickets", exact: true }).click();
    await page.keyboard.press("Escape");
    await bubble.click();
    await expect(side.getByRole("tab", { name: "Tickets", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(side.getByTestId("content-editable").filter({ visible: true })).toHaveCount(0);
    await side.getByRole("button", { name: "Close Side Panel", exact: true }).click();
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    await page.getByRole("option", { name: "Appearance", exact: true }).click();
    await page.getByRole("button", { name: "Tickets", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Default (New session)", exact: true }).click();
    await page.keyboard.press("Escape");
    await bubble.click();
    await expect(side.getByTestId("content-editable").filter({ visible: true })).toContainText(
      "Retain the existing draft",
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
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    await page.getByRole("option", { name: "Appearance", exact: true }).click();
    await page.getByRole("button", { name: "Default (New session)", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Side Panel", exact: true }).click();
    await page.keyboard.press("Escape");
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
    await page.getByRole("button", { name: "Side Panel", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "New session", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveAttribute("data-side-panel-bubble-alignment", "left");
    await bubble.click();
    await expect(side.getByTestId("content-editable").filter({ visible: true })).toBeVisible();
    await side.getByTestId("content-editable").filter({ visible: true }).fill("Keep the bubble's chosen session");
    await side.getByRole("button", { name: "Close Side Panel", exact: true }).click();
    await bubble.click();
    await expect(side.getByTestId("content-editable").filter({ visible: true })).toContainText(
      "Keep the bubble's chosen session",
    );
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
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    await page.getByRole("option", { name: "Appearance", exact: true }).click();
    await page.getByRole("button", { name: "Unavailable panel", exact: true }).click();
    await expect(page.getByRole("menuitemradio", { name: "Default (New session)", exact: true })).toHaveCount(0);
    await expect(page.getByRole("menuitemradio", { name: "New session", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await bubble.click();
    await expect(side).toBeVisible();
    await expect(side.getByTestId("content-editable").filter({ visible: true })).toHaveCount(0);
  });
});
