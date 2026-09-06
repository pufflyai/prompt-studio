import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { createPlannerTicket, executePlannerCommand } from "../helpers/planner-api";

const apiBase = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3200"}`;
const repoRoot = resolve(import.meta.dirname, "../../../..");
const fakeHarness = "pstdio.workbench-fixture.harness.fake";

const createFixture = async (request: APIRequestContext, page: Page) => {
  mkdirSync(resolve(repoRoot, "__test-tmp__"), { recursive: true });
  const repo = mkdtempSync(resolve(repoRoot, "__test-tmp__/ps326-workflow-"));
  execFileSync("git", ["init", repo]);
  writeFileSync(resolve(repo, "README.md"), "Ticket workflow regression\n");
  execFileSync("git", ["-C", repo, "add", "README.md"]);
  execFileSync("git", [
    "-C",
    repo,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "init",
  ]);
  const created = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-326 ticket workflows" } });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  const registered = await request.post(`${apiBase}/v1/projects/${project.id}/repos`, {
    data: { name: "repo", path: repo },
  });
  expect(registered.ok()).toBe(true);
  const repoRecord = (await registered.json()) as { id: string };
  const enabled = await request.post(
    `${apiBase}/v1/projects/${project.id}/extensions/installed/workbench-fixture/enable`,
    {
      data: {
        displayName: "Workbench fixture",
        extensionId: "pstdio.workbench-fixture",
        manifest: { id: "pstdio.workbench-fixture", name: "workbench-fixture" },
        name: "workbench-fixture",
        sourceHash: "ps326-workflows",
        sourceKind: "local_path",
        sourcePath: resolve(repoRoot, "packages/workbench-fixture"),
        sourceRef: null,
        version: null,
      },
    },
  );
  expect(enabled.ok()).toBe(true);
  const configured = await request.patch(`${apiBase}/v1/projects/${project.id}`, {
    data: { default_agent_id: fakeHarness, default_agent_model: null },
  });
  expect(configured.ok()).toBe(true);
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "# Ticket workflow\n\nCheck navigation and actions.",
  });
  await page.addInitScript((projectId) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
  }, project.id);
  return { project, repo, repoRecord, ticket };
};

const openTicket = async (page: Page, projectId: string) => {
  await page.goto(`/projects/${projectId}/extensions/pstdio.pstdio-planner/tickets`);
  await page
    .getByTestId("renderer-card")
    .filter({ hasText: "Ticket workflow" })
    .getByText("Ticket workflow", { exact: true })
    .click();
  await expect(page.getByTestId("content-editable").first()).toContainText("Check navigation and actions.");
};

test("PS-326 refreshes ticket files and allows archiving and deleting linked workspaces", async ({ page, request }) => {
  const fixture = await createFixture(request, page);
  try {
    const workspaces = [];
    for (let index = 0; index < 2; index++) {
      const result = await executePlannerCommand<{ workspace: { id: string; workspace_shorthand: string } }>(
        request,
        apiBase,
        fixture.project.id,
        "create-workspace",
        {
          ticket: fixture.ticket.id,
          repo: { repoId: fixture.repoRecord.id },
        },
      );
      workspaces.push(result.workspace);
    }
    await openTicket(page, fixture.project.id);
    await expect(page.getByRole("tab", { name: "Ticket", exact: true })).toHaveCount(0);
    await page.getByText("Files", { exact: true }).hover();
    const fileResponse = page.waitForResponse(
      (response) =>
        response.url().includes("command.create-ticket-file/execute") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "New file", exact: true }).click();
    const file = (await (await fileResponse).json()).outcome.value as { name: string };
    await expect(page.getByRole("option", { name: file.name, exact: true })).toBeVisible();
    await page.getByRole("option", { name: file.name, exact: true }).click();
    await expect(page.getByTestId("content-editable").first()).toBeVisible();

    for (const [index, workspace] of workspaces.entries()) {
      await page.getByRole("option", { name: workspace.workspace_shorthand, exact: true }).click();
      await expect(page).toHaveURL(/\/workspace\?resource=/);
      await expect(page.getByRole("tab", { name: "Changes", exact: true })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Workspaces", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: `Actions for ${workspace.workspace_shorthand}`, exact: true }).click();
      await expect(page.getByRole("menuitem", { name: "Archive workspace", exact: true })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Delete workspace", exact: true })).toBeVisible();
      const action = index === 0 ? "Archive workspace" : "Delete workspace";
      const response = page.waitForResponse(
        (response) =>
          response.url().includes(`/v1/workspaces/${workspace.id}`) &&
          response.request().method() === (index === 0 ? "POST" : "DELETE"),
      );
      await page.getByRole("menuitem", { name: action, exact: true }).click();
      expect((await response).ok()).toBe(true);
      await page.getByRole("button", { name: `${fixture.ticket.shorthand} Ticket workflow`, exact: true }).click();
      await expect(page.getByRole("option", { name: workspace.workspace_shorthand, exact: true })).toHaveCount(0);
    }
  } finally {
    await request.delete(`${apiBase}/v1/projects/${fixture.project.id}`);
    rmSync(fixture.repo, { recursive: true, force: true });
  }
});

test("PS-326 opens ticket action sessions and hides the lone Sessions page tab", async ({ page, request }) => {
  const fixture = await createFixture(request, page);
  try {
    await openTicket(page, fixture.project.id);
    const ticketUrl = page.url();
    let sessionId = "";
    for (const action of ["Refine ticket", "Break into sub-tickets"]) {
      await page
        .getByRole("button", { name: `Actions for ${fixture.ticket.shorthand} Ticket workflow`, exact: true })
        .click();
      await page.getByRole("menuitem", { name: action, exact: true }).click();
      const dialog = page.getByRole("dialog").filter({ has: page.getByText(action, { exact: true }) });
      await expect(dialog).toBeVisible();
      const response = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          /command\.(refine-ticket|break-into-sub-tickets)\/execute/.test(response.url()),
      );
      await dialog.getByRole("button", { name: "Run", exact: true }).click();
      const outcome = (await (await response).json()).outcome;
      expect(outcome.ok).toBe(true);
      sessionId = outcome.value.id;
      const sidePanel = page.getByTestId("workbench-side-panel-attached");
      await expect(sidePanel).toBeVisible();
      await expect(sidePanel.getByRole("tab")).toHaveCount(0);
      await expect(sidePanel.locator('[data-testid="content-editable"][contenteditable="true"]')).toBeVisible();
      await expect(page).toHaveURL(ticketUrl);
    }
    await page.getByRole("option", { name: "Sessions", exact: true }).first().click();
    await page.getByRole("option", { name: /Break into sub-tickets:/ }).click();
    await expect(page).toHaveURL(new RegExp(`/session\\?resource=.*${sessionId}`));
    await expect(page.getByRole("tab", { name: "Session", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Close Session", exact: true })).toHaveCount(0);
  } finally {
    await request.delete(`${apiBase}/v1/projects/${fixture.project.id}`);
    rmSync(fixture.repo, { recursive: true, force: true });
  }
});
