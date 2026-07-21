import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { createPlannerTicket, executePlannerCommand, getPlannerTicketStatuses } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const deleteAllProjects = async (request: APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) await request.delete(`${apiBase}/v1/projects/${project.id}`);
};

const createProjectViaApi = async (request: APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string };
};

// Mirrors tickets.spec.ts: enough local state to land directly on the tickets board.
const bypassOnboarding = async (page: Page, projectId: string) => {
  await page.addInitScript((currentProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.harness-open-code.opencode");
    localStorage.setItem("dashboard-wb:selected-project:global", currentProjectId);
    localStorage.setItem(
      `pstdio-project-settings/projects/${currentProjectId}/values`,
      JSON.stringify({
        state: {
          lastSelectedAgent: "pstdio.harness-open-code.opencode",
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

test.describe("Ticket sidebar sessions", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Ticket Sidebar Sessions Project");
    projectId = project.id;
  });

  test("lists a Refine ticket session in the open ticket's Sessions sidebar", async ({ page, request }) => {
    const statuses = await getPlannerTicketStatuses(request, apiBase, projectId);
    const ticket = await createPlannerTicket(request, apiBase, projectId, {
      content: "Sidebar session proof",
      statusId: statuses[0]?.id,
    });

    await bypassOnboarding(page, projectId);

    // The SPA router can briefly render "Not found" before it hydrates; retry until the project
    // navigation (the Tickets entry) is interactable.
    const ticketsNav = page.getByRole("option", { name: "Tickets", exact: true });
    await expect(async () => {
      await page.goto("/");
      await expect(ticketsNav).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });

    // Open the tickets board, then the ticket card — this reliably enters ticket mode.
    await ticketsNav.click();
    const card = page.getByTestId("renderer-card").filter({ hasText: "Sidebar session proof" }).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    // Ticket mode renders the open ticket as a selected row in its own left sidebar.
    const sidebar = page.getByRole("complementary");
    await expect(sidebar.getByRole("option", { name: new RegExp(ticket.shorthand) })).toBeVisible({ timeout: 15_000 });

    // Create the ticket-anchored refine session while the ticket is open.
    const session = await executePlannerCommand<{ id: string }>(
      request,
      apiBase,
      projectId,
      "refine-ticket",
      { agent: { harnessId: "pstdio.extension-lab.fake" } },
      {
        resource: {
          type: "ticket",
          id: ticket.id,
          projectId,
          label: ticket.shorthand,
          extensionId: "pstdio.pstdio-planner",
        },
      },
    );
    expect(session.id).toBeTruthy();

    // The session must appear in the ticket-mode left sidebar (scoped so we don't false-match the
    // floating session panel or any "recent sessions" list elsewhere on the page).
    const sessionRow = sidebar.getByText(`Refine ticket: ${ticket.shorthand}`);
    await expect(sessionRow).toBeVisible();

    // Clicking it opens the session in the floating panel and keeps the ticket in view (the ticket
    // stays in its own sidebar — we did not navigate away to sessions mode).
    await sessionRow.click();
    const floatingPanel = page.getByRole("dialog", { name: "Session" });
    await expect(
      floatingPanel.getByRole("tab", { name: new RegExp(`Refine ticket: ${ticket.shorthand}`) }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(sidebar.getByRole("option", { name: `${ticket.shorthand} Sidebar session proof` })).toBeVisible();
  });
});
