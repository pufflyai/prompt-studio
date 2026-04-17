import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string, agentId = "fake") => {
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

const createGitRepo = () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-e2e-ticket-plugin-actions-"));
  execSync("git init", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "ticket plugin action e2e\n");
  execSync("git add README.md", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

const createRepoWithLegacyAttemptAction = () => {
  const repoRoot = createGitRepo();
  const pluginsDir = join(repoRoot, ".pstdio", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(
    join(pluginsDir, "legacy-ticket-actions.ts"),
    `import { definePlugin, renderPrompt } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "legacy-run-attempt",
      label: "Legacy run attempt",
      targetType: "ticket",
      placement: "primary",
      params: [{ key: "repo", label: "Repository", type: "repo" }],
      async trigger(ctx) {
        const repo = ctx.params.repo as { repo: string; branch: string } | undefined;

        return ctx.client.tickets.createAttempt(ctx.targetId, {
          repo_id: repo?.repo,
          branch: repo?.branch,
          prompt: renderPrompt(ctx.prompts["implement-ticket"], { ticket_id: ctx.target.shorthand }),
          start_session: false,
        });
      },
    },
  ],
});`,
  );
  return repoRoot;
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string };
};

const registerRepoViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  path: string,
) => {
  const res = await request.post(`${apiBase}/v1/projects/${projectId}/repos`, {
    data: { name: "legacy-ticket-plugin-repo", path },
  });
  expect(res.ok()).toBe(true);
};

const getTicketStatuses = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const res = await request.get(`${apiBase}/v1/projects/${projectId}/ticket-statuses`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string }[];
};

const createTicketViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  content: string,
  statusId: string,
) => {
  const res = await request.post(`${apiBase}/v1/tickets`, {
    data: { project_id: projectId, content, status_id: statusId },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { shorthand: string };
};

test.describe("Ticket plugin actions", () => {
  let projectId: string;
  const repoDirs: string[] = [];

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Ticket Plugin Actions Project");
    projectId = project.id;
  });

  test.afterEach(() => {
    for (const dir of repoDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    repoDirs.length = 0;
  });

  test("opens a params modal and runs legacy prompt-backed ticket actions", async ({ page, request }) => {
    const repoRoot = createRepoWithLegacyAttemptAction();
    repoDirs.push(repoRoot);
    await registerRepoViaApi(request, projectId, repoRoot);

    const statuses = await getTicketStatuses(request, projectId);
    const backlog = statuses.find((status) => status.name === "backlog");
    expect(backlog).toBeDefined();
    const ticket = await createTicketViaApi(request, projectId, "Legacy action ticket", backlog!.id);

    await bypassOnboarding(page, projectId);
    await page.goto(`/projects/${projectId}/tickets/${ticket.shorthand}`);

    const actionButton = page.getByRole("button", { name: "Legacy run attempt", exact: true });
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    const dialog = page.getByRole("dialog").last();
    await expect(dialog.getByText("Legacy run attempt", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Repository", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Select branch", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Run", exact: true })).toBeEnabled();

    const attemptResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/actions/legacy-ticket-actions%2Flegacy-run-attempt/execute") &&
        response.status() === 200,
    );

    await dialog.getByRole("button", { name: "Run", exact: true }).click();
    await attemptResponse;

    await expect
      .poll(async () => {
        const workspacesRes = await request.get(`${apiBase}/v1/workspaces?project_id=${projectId}`);
        if (!workspacesRes.ok()) return 0;

        const workspaces = (await workspacesRes.json()) as Array<{ ticket_shorthand: string }>;
        return workspaces.filter((workspace) => workspace.ticket_shorthand === ticket.shorthand).length;
      })
      .toBe(1);
  });
});
