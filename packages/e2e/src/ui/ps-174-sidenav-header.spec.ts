import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createPlannerTicket, createPlannerTicketFile, getPlannerTicketStatuses } from "../helpers/planner-api";
import { showHiddenSidenavEntry } from "./helpers/sidenav-navigation";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, stopStorybook, storyUrl } from "./mermaid-renderer-storybook";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const projectModeStoryId = "dashboard-sidenav--project-mode";
const workspacesViewStoryId = "dashboard-sidenav--workspaces-view";
const ticketModeStoryId = "dashboard-sidenav--ticket-mode";
const ticketWorkspaceBackStoryId = "dashboard-sidenav--ticket-workspace-back-journey";
const sessionModeStoryId = "dashboard-sidenav--session-mode";
const allSectionRowNames = ["Search", "Notifications", "Sessions", "Workspaces", "Tickets"] as const;
const projectSectionRowNames = allSectionRowNames.filter((name) => name !== "Workspaces");
const sessionSectionRowNames = projectSectionRowNames.filter((name) => name !== "Sessions");

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-174 Sidenav" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const createSession = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  title: string,
) => {
  const response = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      project_id: projectId,
      title,
      prompt: title,
      agent: "pstdio.workbench-fixture.harness.fake",
    },
  });
  expect(response.ok()).toBe(true);
};

const waitForTicketsExtension = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  await expect
    .poll(
      async () => {
        const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions/ui`);
        if (!response.ok()) return false;
        const metadata = (await response.json()) as { views?: Array<{ id: string; body?: { kind?: string } }> };
        return (
          metadata.views?.some(
            (view) => view.id === "pstdio.pstdio-planner.view.tickets" && view.body?.kind === "kanban",
          ) ?? false
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);
};

const prepareDashboard = async (page: Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
  }, projectId);
  await page.setViewportSize({ width: 1280, height: 720 });
};

const row = (sidenav: Locator, name: (typeof allSectionRowNames)[number]) =>
  name === "Workspaces" || name === "Notifications"
    ? sidenav
        .getByRole("option", {
          name: new RegExp(`^${name}(?:\\s|$)`),
        })
        .first()
    : sidenav.getByRole("option", { name, exact: true }).first();

const expectSidenavSections = async (
  sidenav: Locator,
  visibleNames: readonly (typeof allSectionRowNames)[number][] = projectSectionRowNames,
) => {
  const rows = visibleNames.map((name) => row(sidenav, name));
  for (const sectionRow of rows) await expect(sectionRow).toBeVisible({ timeout: 30_000 });

  const topEdges: number[] = [];
  for (const sectionRow of rows) {
    topEdges.push(await sectionRow.evaluate((element) => element.getBoundingClientRect().top));
  }
  expect(topEdges).toEqual([...topEdges].sort((left, right) => left - right));
  await expect(sidenav.locator('[data-workbench-panel-header="sidenav"]')).toHaveCount(0);
  await expect(sidenav.getByRole("tablist")).toHaveCount(0);
};

test("PS-174 removes and restores owner-scoped collections across project and session pages", async ({
  page,
  request,
}) => {
  test.setTimeout(45_000);
  const project = await createProject(request);
  await waitForTicketsExtension(request, project.id);
  await createSession(request, project.id, "Existing sidenav session");
  await prepareDashboard(page, project.id);
  await page.goto(`/projects/${project.id}`);

  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  await row(sidenav, "Tickets").click();
  const nav = page.locator('[data-workbench-region="nav"]');
  const projectButton = nav.getByRole("button", { name: /PS-174 Sidenav$/ });
  await expect(projectButton).toBeVisible({ timeout: 30_000 });
  const projectBox = await projectButton.boundingBox();
  const breadcrumbBox = await nav.getByRole("navigation", { name: "breadcrumb" }).boundingBox();
  expect(projectBox).not.toBeNull();
  expect(breadcrumbBox).not.toBeNull();
  expect(projectBox!.x).toBeLessThan(breadcrumbBox!.x);
  await expectSidenavSections(sidenav);

  const stableElements = [await projectButton.elementHandle()];
  for (const name of projectSectionRowNames) stableElements.push(await row(sidenav, name).elementHandle());
  expect(stableElements.every(Boolean)).toBe(true);

  await showHiddenSidenavEntry(page, "Workspaces");
  await expectSidenavSections(sidenav, allSectionRowNames);
  await row(sidenav, "Workspaces").click();
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByText("Workspaces", { exact: true }),
  ).toBeVisible();
  await expectSidenavSections(sidenav, allSectionRowNames);
  for (const element of stableElements) expect(await element!.evaluate((node) => node.isConnected)).toBe(true);

  await row(sidenav, "Sessions").click();
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByText("Sessions", { exact: true }),
  ).toBeVisible();
  await expectSidenavSections(
    sidenav,
    allSectionRowNames.filter((name) => name !== "Sessions"),
  );
  await expect(sidenav.locator('[data-tree-list-node-id="sessions"]')).toHaveCount(0);
  await expect(sidenav.locator('[data-tree-list-node-id="workspace-sessions"]')).toBeVisible();
  await expect(sidenav.getByRole("option", { name: "Existing sidenav session", exact: true })).toBeVisible();
  await expect(sidenav.getByRole("button", { name: "Help", exact: true })).toBeVisible();
  await expect(sidenav.getByRole("option", { name: "Settings", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Navigate back" }).click();
  await expectSidenavSections(sidenav, allSectionRowNames);
  await row(sidenav, "Tickets").click();
  await expect(row(sidenav, "Tickets")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Create row", exact: true })).toBeVisible();
  await expectSidenavSections(sidenav);
});

test("PS-174 customizes the Sidenav from any point and persists section visibility", async ({ page, request }) => {
  test.setTimeout(45_000);
  const project = await createProject(request);
  await waitForTicketsExtension(request, project.id);
  await prepareDashboard(page, project.id);
  await page.goto(`/projects/${project.id}`);

  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const projectButton = page.locator('[data-workbench-region="nav"]').getByRole("button", { name: /PS-174 Sidenav$/ });
  await expect(projectButton).toBeVisible({ timeout: 30_000 });
  await expectSidenavSections(sidenav);
  await expect(row(sidenav, "Workspaces")).toHaveCount(0);

  await row(sidenav, "Search").click({ button: "right" });
  const searchToggle = page.getByRole("menuitem", { name: /Search/ });
  const workspacesToggle = page.getByRole("menuitem", { name: /Workspaces/ });
  await expect(searchToggle).toBeVisible();
  await expect(workspacesToggle).toBeVisible();
  await workspacesToggle.click();
  await expect(row(sidenav, "Workspaces")).toBeVisible();
  await searchToggle.click();
  await expect(row(sidenav, "Search")).toHaveCount(0);
  await expect(searchToggle).toBeVisible();
  await searchToggle.click();
  await expect(row(sidenav, "Search")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(searchToggle).toBeHidden();

  await row(sidenav, "Tickets").click({ button: "right" });
  const ticketsToggle = page.getByRole("menuitem", { name: "Tickets", exact: true });
  await expect(ticketsToggle).toBeVisible();
  await ticketsToggle.click();
  await expect(row(sidenav, "Tickets")).toHaveCount(0);
  await expect(ticketsToggle).toBeVisible();
  await ticketsToggle.click();
  await expect(row(sidenav, "Tickets")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.reload();
  await expect(row(sidenav, "Workspaces")).toBeVisible();
  await expectSidenavSections(sidenav, allSectionRowNames);

  await row(sidenav, "Search").click({ button: "right" });
  await searchToggle.click();
  await expect(row(sidenav, "Search")).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Reset to default", exact: true }).click();
  await expect(row(sidenav, "Search")).toBeVisible();
  await expectSidenavSections(sidenav);
  await expect(row(sidenav, "Workspaces")).toHaveCount(0);

  const resetTopEdges = await Promise.all(
    [row(sidenav, "Search"), row(sidenav, "Notifications")].map(async (item) => (await item.boundingBox())!.y),
  );
  expect(resetTopEdges[0]).toBeLessThan(resetTopEdges[1]);
});

test("PS-174 renders the ticket tree inside the Sidenav resource section", async ({ page, request }) => {
  test.setTimeout(45_000);
  const project = await createProject(request);
  await waitForTicketsExtension(request, project.id);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const defaultStatus = statuses.find((status) => status.isDefault) ?? statuses[0];
  expect(defaultStatus).toBeTruthy();
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "Sidenav resource ticket",
    statusId: defaultStatus!.id,
  });
  await createPlannerTicketFile(request, apiBase, project.id, ticket.id, {
    name: "research.md",
    content: "# Research",
  });
  await prepareDashboard(page, project.id);
  await page.goto("/");
  await page.getByRole("option", { name: "Tickets", exact: true }).click();

  const card = page.getByTestId("renderer-card").filter({ hasText: ticket.title }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByText(ticket.title, { exact: true }).click();

  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  await expectSidenavSections(sidenav);
  await expect(sidenav.getByRole("option", { name: new RegExp(`^${ticket.shorthand}(?:\\s|$)`) })).toBeVisible();
  await expect(sidenav.getByRole("option", { name: /research/ })).toBeVisible();
});

test.describe("PS-174 Dashboard Sidenav stories", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(projectModeStoryId, "pstdio-dashboard"));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  for (const storyId of [
    projectModeStoryId,
    workspacesViewStoryId,
    ticketModeStoryId,
    ticketWorkspaceBackStoryId,
    sessionModeStoryId,
  ]) {
    test(`renders ${storyId} as ordered sections without a panel header`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(storyUrl(baseUrl, storyId));

      const sidenav = page.locator('[data-workbench-region="sidenav"]');
      await expect(
        page.locator('[data-workbench-region="nav"]').getByRole("button", { name: /Prompt Studio$/ }),
      ).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
      await expectSidenavSections(sidenav, storyId === sessionModeStoryId ? sessionSectionRowNames : undefined);
      await expect(row(sidenav, "Workspaces")).toHaveCount(0);
      if (storyId === ticketModeStoryId) {
        await expect(sidenav.getByRole("option", { name: "research.md", exact: true })).toBeVisible();
      }
      if (storyId === ticketWorkspaceBackStoryId)
        await expect(sidenav.getByRole("option", { name: "PS-164_A1", exact: true })).toBeVisible();
      if (storyId === sessionModeStoryId) {
        await expect(sidenav.locator('[data-tree-list-node-id="sessions"]')).toHaveCount(0);
        await expect(sidenav.getByRole("option", { name: "Refactor sidenav", exact: true })).toBeVisible();
        await expect(sidenav.getByRole("button", { name: "Help", exact: true })).toBeVisible();
        await expect(sidenav.getByRole("option", { name: "Settings", exact: true })).toBeVisible();
      }
    });
  }
});
