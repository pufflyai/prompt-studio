import { expect, test } from "@playwright/test";
import { createPlannerTicket, createPlannerTicketFile, getPlannerTicketStatuses } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (
  page: import("@playwright/test").Page,
  projectId: string,
  agentId = "pstdio.harness-open-code.harness.opencode",
) => {
  await page.addInitScript(
    ({ currentProjectId, currentAgentId }: { currentProjectId: string; currentAgentId: string }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", currentAgentId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${currentProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: currentAgentId,
            lastSelectedModels: [],
            lastSelectedRepo: "",
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { currentProjectId: projectId, currentAgentId: agentId },
  );
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  expect(res.ok()).toBe(true);

  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const getTicketStatuses = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  return getPlannerTicketStatuses(request, apiBase, projectId);
};

const createTicketViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  content: string,
  statusId: string,
) => {
  return createPlannerTicket(request, apiBase, projectId, { content, statusId });
};

const uploadTicketFileViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  ticketId: string,
  fileName: string,
  content: string,
) => {
  await createPlannerTicketFile(request, apiBase, projectId, ticketId, { name: fileName, content });
};

const createOverflowProjectsViaApi = async (request: import("@playwright/test").APIRequestContext, count: number) => {
  for (let index = 0; index < count; index += 1) {
    await createProjectViaApi(request, `stale-reconnect-overflow-project-${index}`);
  }
};

test.describe("stale sync reconnect on dashboard", () => {
  let projectId: string;
  let ticketId: string;
  let ticketShorthand: string;

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);

    const project = await createProjectViaApi(request, "stale-reconnect-dashboard-project");
    projectId = project.id;

    const statuses = await getTicketStatuses(request, projectId);
    const backlogStatus = statuses.find((status) => status.name === "backlog");
    expect(backlogStatus).toBeTruthy();

    const ticket = await createTicketViaApi(request, projectId, "stale reconnect ticket body", backlogStatus!.id);

    ticketId = ticket.id;
    ticketShorthand = ticket.shorthand;
  });

  test("reconnects with stale seq and keeps ticket files in sync without refresh", async ({
    page,
    request,
    context,
  }) => {
    const uploadedFileName = "reconnect-proof.md";
    const uploadedFileLabel = "reconnect-proof";

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets/${ticketShorthand}`);

    await expect(page.getByText("Ticket", { exact: true })).toBeVisible();
    await expect(page.getByText(uploadedFileLabel, { exact: true })).not.toBeVisible();

    await context.setOffline(true);

    await uploadTicketFileViaApi(request, ticketId, uploadedFileName, "file created while client is offline");

    await createOverflowProjectsViaApi(request, 65);

    await context.setOffline(false);

    await expect(page.getByText(uploadedFileLabel, { exact: true })).toBeVisible({ timeout: 12_000 });
  });
});
