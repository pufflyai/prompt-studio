import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { createPlannerTicket, executePlannerCommand, getPlannerTicketStatuses } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const deleteAllProjects = async (request: APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  const projects = (await response.json()) as { id: string }[];
  for (const project of projects) await request.delete(`${apiBase}/v1/projects/${project.id}`);
};

const createProjectViaApi = async (request: APIRequestContext, name: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

// Enough local state to land directly on the tickets board (mirrors tickets.spec.ts).
const bypassOnboarding = async (page: Page, projectId: string) => {
  await page.addInitScript((currentProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", currentProjectId);
    localStorage.setItem(
      `pstdio-project-settings/projects/${currentProjectId}/values`,
      JSON.stringify({
        state: {
          lastSelectedAgent: "pstdio.extension-lab.harness.fake",
          lastSelectedModels: [],
          lastSelectedRepo: "",
          lastSelectedBranches: [],
          sessionModalState: "closed",
          selectedSessionId: null,
        },
        version: 0,
      }),
    );
  }, projectId);
};

const openTicketBoard = async (page: Page) => {
  const ticketsNav = page.getByRole("option", { name: "Tickets", exact: true });
  await expect(async () => {
    await page.goto("/");
    await expect(ticketsNav).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await ticketsNav.click();
};

const openTicketCard = async (page: Page, ticketContent: string) => {
  const card = page.getByTestId("renderer-card").filter({ hasText: ticketContent }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
};

test("PS-8 reuses a dashboard session tab selected again from a planner ticket", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "PS-8 Session Tab Reuse");
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "Reuse session A across resource surfaces",
    statusId: statuses[0]?.id,
  });
  await executePlannerCommand<{ id: string }>(
    request,
    apiBase,
    project.id,
    "refine-ticket",
    { agent: { harnessId: "pstdio.extension-lab.harness.fake" } },
    {
      resource: {
        type: "ticket",
        id: ticket.id,
        projectId: project.id,
        label: ticket.shorthand,
        extensionId: "pstdio.pstdio-planner",
      },
    },
  );

  await bypassOnboarding(page, project.id);
  await openTicketBoard(page);
  await openTicketCard(page, "Reuse session A across resource surfaces");
  const sessionRow = page.getByRole("complementary").getByText(`Refine ticket: ${ticket.shorthand}`);
  await expect(sessionRow).toBeVisible();
  await sessionRow.click();

  const floatingPanel = page.getByRole("dialog", { name: "Side Panel" });
  const sessionTabs = floatingPanel.getByRole("tab");
  const sessionTab = floatingPanel.getByRole("tab", { name: new RegExp(`Refine ticket: ${ticket.shorthand}`) });
  await expect(sessionTabs).toHaveCount(1);
  await expect(sessionTab).toHaveAttribute("aria-selected", "true");

  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await openTicketCard(page, "Reuse session A across resource surfaces");
  await sessionRow.click();

  await expect(sessionTabs).toHaveCount(1);
  await expect(sessionTab).toHaveAttribute("aria-selected", "true");
});

test("PS-8 restores an attached session Side Panel and its session across refresh", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "PS-8 Session Panel Restore");
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "Session panel survives refresh",
    statusId: statuses[0]?.id,
  });

  const session = await executePlannerCommand<{ id: string }>(
    request,
    apiBase,
    project.id,
    "refine-ticket",
    { agent: { harnessId: "pstdio.extension-lab.harness.fake" } },
    {
      resource: {
        type: "ticket",
        id: ticket.id,
        projectId: project.id,
        label: ticket.shorthand,
        extensionId: "pstdio.pstdio-planner",
      },
    },
  );
  expect(session.id).toBeTruthy();

  await bypassOnboarding(page, project.id);
  await openTicketBoard(page);
  await openTicketCard(page, "Session panel survives refresh");

  const sidenav = page.getByRole("complementary");
  await expect(
    sidenav.getByRole("option", { name: `${ticket.shorthand} Session panel survives refresh`, exact: true }),
  ).toBeVisible({ timeout: 15_000 });

  const sessionRow = sidenav.getByText(`Refine ticket: ${ticket.shorthand}`);
  await expect(sessionRow).toBeVisible();
  await sessionRow.click();

  const floatingPanel = page.getByRole("dialog", { name: "Side Panel" });
  await expect(
    floatingPanel.getByRole("tab", { name: new RegExp(`Refine ticket: ${ticket.shorthand}`) }),
  ).toHaveAttribute("aria-selected", "true");

  // Reattach the floating Side Panel, then refresh like a user reopening the page.
  await floatingPanel.getByRole("button", { name: "Reattach Side Panel" }).click();
  const attachedPanel = page.getByTestId("workbench-side-panel-attached");
  await expect(attachedPanel).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Side Panel" })).toHaveCount(0);

  await page.reload();
  await expect(async () => {
    await expect(attachedPanel).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await expect(
    attachedPanel.getByRole("tab", { name: new RegExp(`Refine ticket: ${ticket.shorthand}`) }),
  ).toHaveAttribute("aria-selected", "true");

  const draft = "Keep this unsent PS-8 draft across refresh";
  const chatInput = attachedPanel.locator("[data-testid='content-editable'][contenteditable='true']");
  await chatInput.fill(draft);
  await expect(chatInput).toHaveText(draft);

  await page.reload();
  await expect(async () => {
    await expect(attachedPanel).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await expect(attachedPanel.locator("[data-testid='content-editable'][contenteditable='true']")).toHaveText(draft);

  // The persisted primary resource (the ticket) survives alongside the Side Panel session.
  await expect(
    sidenav.getByRole("option", { name: `${ticket.shorthand} Session panel survives refresh` }),
  ).toBeVisible();
});

test("PS-8 keeps a closed Side Panel closed and does not reopen a session after refresh", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "PS-8 Session Panel Restore Closed");
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  await createPlannerTicket(request, apiBase, project.id, {
    content: "Closed panel stays closed",
    statusId: statuses[0]?.id,
  });

  await bypassOnboarding(page, project.id);
  await openTicketBoard(page);
  await openTicketCard(page, "Closed panel stays closed");

  await expect(page.getByTestId("workbench-side-panel-attached")).not.toBeVisible();
  await expect(page.getByRole("dialog", { name: "Side Panel" })).toHaveCount(0);

  await page.reload();
  await expect(async () => {
    await expect(page.getByRole("option", { name: "Tickets", exact: true })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByTestId("workbench-side-panel-attached")).not.toBeVisible();
  await expect(page.getByRole("dialog", { name: "Side Panel" })).toHaveCount(0);
});
