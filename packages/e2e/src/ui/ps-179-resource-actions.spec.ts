import { rmSync } from "node:fs";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { createPlannerAttempt, createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { showHiddenSidenavEntry } from "./helpers/sidenav-navigation";
import { createGitRepo, registerRepoViaApi } from "./helpers/workspace-session-attempt";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const createProject = async (request: APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-179 Resource Actions" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: Page, projectId: string, repoId: string) => {
  await page.addInitScript(
    ({ selectedProjectId, selectedRepoId }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
      localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${selectedProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.extension-lab.harness.fake",
            lastSelectedModels: [],
            lastSelectedRepo: selectedRepoId,
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { selectedProjectId: projectId, selectedRepoId: repoId },
  );
};

const expectMenuItems = async (page: Page, labels: string[]) => {
  for (const label of labels) {
    await expect(page.getByRole("menuitem", { name: label, exact: true })).toBeVisible();
  }
};

test("PS-179 exposes the same ticket and workspace actions on rows and breadcrumbs", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  const repoRoot = createGitRepo("pstdio-ps-179-", "resource actions e2e");
  const repo = await registerRepoViaApi(request, apiBase, project.id, "ps-179-repo", repoRoot);

  try {
    const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
    const statusId = (statuses.find((status) => status.isDefault) ?? statuses[0])?.id;
    const ticket = await createPlannerTicket(request, apiBase, project.id, {
      content: "PS-179 keeps actions beside resources",
      statusId,
    });
    const attempt = await createPlannerAttempt(request, apiBase, project.id, {
      ticketId: ticket.id,
      repoId: repo.id,
      mode: "worktree",
    });

    await prepareDashboard(page, project.id, repo.id);
    await page.goto(`/projects/${project.id}/tickets`);

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    await sidenav.getByRole("option", { name: "Tickets", exact: true }).first().click();
    const ticketCard = page.locator('[data-testid="renderer-card"]:visible').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible({ timeout: 30_000 });
    await ticketCard.getByText(ticket.title, { exact: true }).click();
    await expect(
      sidenav.getByRole("option", {
        name: `${ticket.shorthand} ${ticket.title}`,
        exact: true,
      }),
    ).toBeVisible();
    const workspacesNavigation = await showHiddenSidenavEntry(page, "Workspaces");
    await workspacesNavigation.click();
    await sidenav.getByRole("option", { name: "Tickets", exact: true }).first().click();
    await expect(ticketCard).toBeVisible();

    await ticketCard.click({ button: "right" });
    await expectMenuItems(page, ["Create workspace", "Run attempt", "Refine ticket", "Break into sub-tickets"]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: "Run attempt", exact: true })).toBeHidden();
    await ticketCard.getByText(ticket.title, { exact: true }).click();
    await expect(
      sidenav.getByRole("option", {
        name: `${ticket.shorthand} ${ticket.title}`,
        exact: true,
      }),
    ).toBeVisible();
    await workspacesNavigation.click();
    await sidenav.getByRole("option", { name: "Tickets", exact: true }).first().click();
    await expect(ticketCard).toBeVisible();

    const typeTag = ticketCard.getByRole("button", { name: "Type", exact: true });
    await typeTag.hover();
    await expect(page.getByRole("menuitemradio", { name: "Bug", exact: true })).toHaveCount(0);
    await typeTag.click();
    const bugMenuItem = page.getByRole("menuitemradio", {
      name: "Bug",
      exact: true,
    });
    await expect(bugMenuItem).toBeVisible();
    const updateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith(
          "/extensions/commands/pstdio.pstdio-planner.view.tickets.kanban.onAttributeChange/execute",
        ) &&
        response.status() === 200,
    );
    await bugMenuItem.click();
    await updateResponse;
    await expect(bugMenuItem).toBeHidden();
    await ticketCard.getByText(ticket.title, { exact: true }).click();
    const selectedTicketRow = sidenav.getByRole("option", {
      name: `${ticket.shorthand} ${ticket.title}`,
      exact: true,
    });
    await expect(selectedTicketRow).toBeVisible();
    await expect(page.getByTestId("content-editable").first()).toContainText("PS-179 keeps actions beside resources");
    const breadcrumbAction = page.locator("[data-workbench-breadcrumb-resource-actions]");
    await expect(breadcrumbAction).toBeVisible();
    await breadcrumbAction.click();
    await expectMenuItems(page, ["Create workspace", "Run attempt", "Refine ticket", "Break into sub-tickets"]);
    await breadcrumbAction.click();
    await expect(page.getByRole("menuitem", { name: "Run attempt", exact: true })).toBeHidden();

    await workspacesNavigation.click();
    const workspaceRow = page.getByRole("row").filter({ hasText: attempt.workspace.workspace_shorthand }).first();
    await expect(workspaceRow).toBeVisible({ timeout: 30_000 });
    await workspaceRow.getByRole("button", { name: "Row actions" }).click();
    await expectMenuItems(page, ["Open terminal", "Rename workspace", "Archive workspace", "Delete workspace"]);
    await page.keyboard.press("Escape");

    await workspaceRow.getByRole("cell", { name: "Worktree", exact: true }).click();
    await expect(breadcrumbAction).toBeVisible();
    await breadcrumbAction.click();
    await expectMenuItems(page, ["Open terminal", "Rename workspace", "Archive workspace", "Delete workspace"]);
    await breadcrumbAction.click();
    await expect(page.getByRole("menuitem", { name: "Open terminal", exact: true })).toBeHidden();
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("PS-179 keeps ticket creation and ticket status settings available", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  await prepareDashboard(page, project.id, "");
  await page.goto(`/projects/${project.id}/tickets`);

  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  await sidenav.getByRole("option", { name: "Tickets", exact: true }).first().click();

  await page.getByRole("button", { name: "Create row", exact: true }).first().click();
  const createDialog = page.getByRole("dialog").last();
  await expect(createDialog).toBeVisible();
  await createDialog.getByRole("textbox").first().fill("Create flow remains available");

  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith(
        "/extensions/commands/pstdio.pstdio-planner.command.create-ticket/execute",
      ),
  );
  await createDialog.getByRole("button", { name: "Create ticket", exact: true }).click();
  expect((await createResponse).ok()).toBe(true);
  await expect(createDialog).toBeHidden();
  await expect(sidenav.getByRole("option").filter({ hasText: "Create flow remains available" })).toBeVisible();
  await sidenav.getByRole("option", { name: "Tickets", exact: true }).first().click();
  await expect(page.getByTestId("renderer-card").filter({ hasText: "Create flow remains available" })).toBeVisible();

  await sidenav.getByRole("option", { name: "Settings", exact: true }).click();
  const settingsDialog = page.getByRole("dialog").last();
  await expect(settingsDialog.getByRole("option", { name: "Statuses", exact: true })).toBeVisible();
  await expect(settingsDialog.getByRole("option", { name: "Ticket tags", exact: true })).toBeVisible();
  await settingsDialog.getByRole("option", { name: "Statuses", exact: true }).click();
  await expect(settingsDialog.getByText("Ticket status", { exact: true })).toBeVisible();
});
