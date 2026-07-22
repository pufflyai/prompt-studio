import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createPlannerTicket, createPlannerTicketFile, getPlannerTicketStatuses } from "../helpers/planner-api";
import { startStorybook, storyUrl } from "./mermaid-renderer-storybook";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const projectModeStoryId = "dashboard-sidebar--project-mode";
const workspacesViewStoryId = "dashboard-sidebar--workspaces-view";
const ticketModeStoryId = "dashboard-sidebar--ticket-mode";
const sessionModeStoryId = "dashboard-sidebar--session-mode";
const globalRowNames = ["Search", "Notifications", "Sessions", "Workspaces", "Tickets"] as const;

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-174 Sidebar" } });
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

const row = (sidebar: Locator, name: (typeof globalRowNames)[number]) =>
  name === "Workspaces" || name === "Notifications"
    ? sidebar.getByRole("region", { name: "Sidebar header" }).getByRole("option", {
        name: new RegExp(`^${name}(?:\\s|$)`),
      })
    : sidebar.getByRole("region", { name: "Sidebar header" }).getByRole("option", { name, exact: true });

const expectGlobalHeader = async (sidebar: Locator) => {
  const rows = globalRowNames.map((name) => row(sidebar, name));
  for (const globalRow of rows) await expect(globalRow).toHaveCount(1, { timeout: 30_000 });

  const topEdges = await Promise.all(
    rows.map(async (globalRow) => {
      const box = await globalRow.boundingBox();
      expect(box).not.toBeNull();
      return box!.y;
    }),
  );
  expect(topEdges).toEqual([...topEdges].sort((left, right) => left - right));
  await expect(sidebar.getByText("Sidebar tabs", { exact: true })).toHaveCount(0);
  await expect(sidebar.getByText("Ticket tabs", { exact: true })).toHaveCount(0);
};

test("PS-174 keeps project-owned collections ordered and stable across aggregate pages", async ({ page, request }) => {
  test.setTimeout(45_000);
  const project = await createProject(request);
  await waitForTicketsExtension(request, project.id);
  await createSession(request, project.id, "Existing sidebar session");
  await prepareDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

  const sidebar = page.locator('[data-workbench-region="sidebar"]');
  const projectButton = sidebar.getByRole("button", { name: "PS-174 Sidebar" });
  await expect(projectButton).toBeVisible({ timeout: 30_000 });
  await expectGlobalHeader(sidebar);
  await expect(sidebar.getByRole("option", { name: "Lab mode", exact: true })).toBeVisible();

  const stableElements = [await projectButton.elementHandle()];
  for (const name of globalRowNames) stableElements.push(await row(sidebar, name).elementHandle());
  expect(stableElements.every(Boolean)).toBe(true);

  await row(sidebar, "Workspaces").click();
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByText("Workspaces", { exact: true }),
  ).toBeVisible();
  await expectGlobalHeader(sidebar);

  await row(sidebar, "Sessions").click();
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByText("Sessions", { exact: true }),
  ).toBeVisible();
  await expectGlobalHeader(sidebar);
  await sidebar.getByRole("option", { name: "Sessions", exact: true }).last().click();
  await expect(sidebar.getByRole("option", { name: "Existing sidebar session", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Help", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("option", { name: "Settings", exact: true })).toBeVisible();

  await row(sidebar, "Tickets").click();
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByText("Tickets", { exact: true }),
  ).toBeVisible();
  await expectGlobalHeader(sidebar);

  for (const element of stableElements) expect(await element!.evaluate((node) => node.isConnected)).toBe(true);
});

test("PS-174 renders the ticket tree inside the Sidebar resource section", async ({ page, request }) => {
  test.setTimeout(45_000);
  const project = await createProject(request);
  await waitForTicketsExtension(request, project.id);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const defaultStatus = statuses.find((status) => status.isDefault) ?? statuses[0];
  expect(defaultStatus).toBeTruthy();
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "Sidebar resource ticket",
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

  const sidebar = page.locator('[data-workbench-region="sidebar"]');
  await expectGlobalHeader(sidebar);
  await expect(sidebar.getByRole("option", { name: new RegExp(ticket.shorthand) })).toBeVisible();
  await expect(sidebar.getByRole("option", { name: /research/ })).toBeVisible();
});

test.describe("PS-174 Dashboard Sidebar stories", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(projectModeStoryId, "pstdio-dashboard"));
  });

  test.afterAll(() => {
    storybook?.kill();
  });

  for (const storyId of [projectModeStoryId, workspacesViewStoryId, ticketModeStoryId, sessionModeStoryId]) {
    test(`renders ${storyId} with one persistent global header`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(storyUrl(baseUrl, storyId));

      const sidebar = page.locator('[data-workbench-region="sidebar"]');
      await expect(sidebar.getByRole("button", { name: "Prompt Studio" })).toBeVisible({ timeout: 30_000 });
      await expectGlobalHeader(sidebar);
      if (storyId === ticketModeStoryId) {
        await expect(sidebar.getByRole("option", { name: "research.md", exact: true })).toBeVisible();
      }
      if (storyId === sessionModeStoryId) {
        await sidebar.getByRole("option", { name: "Sessions", exact: true }).last().click();
        await expect(sidebar.getByRole("option", { name: "Refactor sidebar", exact: true })).toBeVisible();
        await expect(sidebar.getByRole("button", { name: "Help", exact: true })).toBeVisible();
        await expect(sidebar.getByRole("option", { name: "Settings", exact: true })).toBeVisible();
      }
    });
  }
});
