import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createPlannerTicket, createPlannerTicketFile, getPlannerTicketStatuses } from "../helpers/planner-api";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const projectModeStoryId = "dashboard-sidenav--project-mode";
const workspacesViewStoryId = "dashboard-sidenav--workspaces-view";
const ticketModeStoryId = "dashboard-sidenav--ticket-mode";
const ticketWorkspaceBackStoryId = "dashboard-sidenav--ticket-workspace-back-journey";
const sessionModeStoryId = "dashboard-sidenav--session-mode";
const globalRowNames = ["Search", "Notifications", "Sessions", "Workspaces", "Tickets"] as const;

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
      agent: "pstdio.extension-lab.fake",
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
        const metadata = (await response.json()) as { dataRenderers?: Array<{ resourceKind?: string }> };
        return metadata.dataRenderers?.some((renderer) => renderer.resourceKind === "ticket") ?? false;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
};

const prepareDashboard = async (page: Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
  await page.setViewportSize({ width: 1280, height: 720 });
};

const row = (sidenav: Locator, name: (typeof globalRowNames)[number]) =>
  name === "Workspaces" || name === "Notifications"
    ? sidenav
        .getByRole("option", {
          name: new RegExp(`^${name}(?:\\s|$)`),
        })
        .first()
    : sidenav.getByRole("option", { name, exact: true }).first();

const expectGlobalHeader = async (sidenav: Locator) => {
  const rows = globalRowNames.map((name) => row(sidenav, name));
  for (const globalRow of rows) await expect(globalRow).toBeVisible({ timeout: 30_000 });

  const topEdges: number[] = [];
  for (const globalRow of rows) {
    topEdges.push(await globalRow.evaluate((element) => element.getBoundingClientRect().top));
  }
  expect(topEdges).toEqual([...topEdges].sort((left, right) => left - right));
  await expect(sidenav.getByText("Sidenav tabs", { exact: true })).toHaveCount(0);
  await expect(sidenav.getByText("Ticket tabs", { exact: true })).toHaveCount(0);
};

const dragBefore = async (page: Page, source: Locator, target: Locator) => {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2 - 8, { steps: 4 });
  await page.waitForTimeout(50);
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 8 });
  await page.waitForTimeout(50);
  await page.mouse.up();
};

test("PS-174 keeps project-owned collections ordered and stable across aggregate pages", async ({ page, request }) => {
  test.setTimeout(45_000);
  const project = await createProject(request);
  await waitForTicketsExtension(request, project.id);
  await createSession(request, project.id, "Existing sidenav session");
  await prepareDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const nav = page.locator('[data-workbench-region="nav"]');
  const projectButton = nav.getByRole("button", { name: /PS-174 Sidenav$/ });
  await expect(projectButton).toBeVisible({ timeout: 30_000 });
  const projectBox = await projectButton.boundingBox();
  const breadcrumbBox = await nav.getByRole("navigation", { name: "breadcrumb" }).boundingBox();
  expect(projectBox).not.toBeNull();
  expect(breadcrumbBox).not.toBeNull();
  expect(projectBox!.x).toBeLessThan(breadcrumbBox!.x);
  await expectGlobalHeader(sidenav);
  await expect(sidenav.getByRole("option", { name: "Lab coding mode", exact: true })).toBeVisible();

  const stableElements = [await projectButton.elementHandle()];
  for (const name of globalRowNames) stableElements.push(await row(sidenav, name).elementHandle());
  expect(stableElements.every(Boolean)).toBe(true);

  await row(sidenav, "Workspaces").click();
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByText("Workspaces", { exact: true }),
  ).toBeVisible();
  await expectGlobalHeader(sidenav);

  await row(sidenav, "Sessions").click();
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByText("Sessions", { exact: true }),
  ).toBeVisible();
  await expectGlobalHeader(sidenav);
  await sidenav.getByRole("option", { name: "Sessions", exact: true }).last().click();
  await expect(sidenav.getByRole("option", { name: "Existing sidenav session", exact: true })).toBeVisible();
  await expect(sidenav.getByRole("button", { name: "Help", exact: true })).toBeVisible();
  await expect(sidenav.getByRole("option", { name: "Settings", exact: true })).toBeVisible();

  await row(sidenav, "Tickets").click();
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByText("Tickets", { exact: true }),
  ).toBeVisible();
  await expectGlobalHeader(sidenav);

  for (const element of stableElements) expect(await element!.evaluate((node) => node.isConnected)).toBe(true);
});

test("PS-174 customizes the Sidenav from any point and persists header ordering", async ({ page, request }) => {
  test.setTimeout(45_000);
  const project = await createProject(request);
  await waitForTicketsExtension(request, project.id);
  await prepareDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const projectButton = page.locator('[data-workbench-region="nav"]').getByRole("button", { name: /PS-174 Sidenav$/ });
  await expect(projectButton).toBeVisible({ timeout: 30_000 });
  await expectGlobalHeader(sidenav);

  await row(sidenav, "Search").click({ button: "right" });
  const searchToggle = page.getByRole("menuitem", { name: /Search/ });
  await expect(searchToggle).toBeVisible();
  await searchToggle.click();
  await expect(row(sidenav, "Search")).toHaveCount(0);
  await expect(searchToggle).toBeVisible();
  await searchToggle.click();
  await expect(row(sidenav, "Search")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(searchToggle).toBeHidden();

  await dragBefore(page, row(sidenav, "Notifications"), row(sidenav, "Search"));
  const reorderedTopEdges = await Promise.all(
    [row(sidenav, "Notifications"), row(sidenav, "Search")].map(async (item) => (await item.boundingBox())!.y),
  );
  expect(reorderedTopEdges[0]).toBeLessThan(reorderedTopEdges[1]);

  await page.reload();
  const persistedTopEdges = await Promise.all(
    [row(sidenav, "Notifications"), row(sidenav, "Search")].map(async (item) => (await item.boundingBox())!.y),
  );
  expect(persistedTopEdges[0]).toBeLessThan(persistedTopEdges[1]);

  await row(sidenav, "Search").click({ button: "right" });
  await searchToggle.click();
  await expect(row(sidenav, "Search")).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Reset to default", exact: true }).click();
  await expect(row(sidenav, "Search")).toBeVisible();

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
  await expectGlobalHeader(sidenav);
  await expect(sidenav.getByRole("option", { name: new RegExp(ticket.shorthand) })).toBeVisible();
  await expect(sidenav.getByRole("option", { name: /research/ })).toBeVisible();
});

test.describe("PS-174 Dashboard Sidenav stories", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(projectModeStoryId, "pstdio-dashboard"));
  });

  test.afterAll(() => {
    storybook?.kill();
  });

  for (const storyId of [
    projectModeStoryId,
    workspacesViewStoryId,
    ticketModeStoryId,
    ticketWorkspaceBackStoryId,
    sessionModeStoryId,
  ]) {
    test(`renders ${storyId} with one persistent global header`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(storyUrl(baseUrl, storyId));
      // Forward history and the trimmed breadcrumb below only exist once this story's play
      // function has navigated in and back, and "PS-164_A1" is absent both before and during
      // that. Playback also covers the first render, so it stands in for the render gate.
      if (storyId === ticketWorkspaceBackStoryId) await waitForStoryPlayback(page);

      const sidenav = page.locator('[data-workbench-region="sidenav"]');
      await expect(
        page.locator('[data-workbench-region="nav"]').getByRole("button", { name: /Prompt Studio$/ }),
      ).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
      await expectGlobalHeader(sidenav);
      if (storyId === ticketModeStoryId) {
        await expect(sidenav.getByRole("option", { name: "research.md", exact: true })).toBeVisible();
      }
      if (storyId === ticketWorkspaceBackStoryId) {
        const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
        await expect(page.getByRole("button", { name: "Navigate forward" })).toBeEnabled();
        await expect(breadcrumb).toContainText("PS-164 Sidenav resource sections");
        await expect(breadcrumb).not.toContainText("PS-164_A1");
      }
      if (storyId === sessionModeStoryId) {
        await sidenav.getByRole("option", { name: "Sessions", exact: true }).last().click();
        await expect(sidenav.getByRole("option", { name: "Refactor sidenav", exact: true })).toBeVisible();
        await expect(sidenav.getByRole("button", { name: "Help", exact: true })).toBeVisible();
        await expect(sidenav.getByRole("option", { name: "Settings", exact: true })).toBeVisible();
      }
    });
  }
});
