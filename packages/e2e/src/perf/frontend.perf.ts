import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createPlannerAttempt, createPlannerTicket } from "../helpers/planner-api";
import {
  calculateStats,
  getTotalLongTaskDuration,
  installLongTaskObserver,
  markNow,
  navigateForRouteMeasure,
  throttleChromiumCpu,
  waitForMark,
} from "./perf-helpers";

const apiPort = Number(process.env.E2E_API_PORT ?? "3300");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((currentProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "fake");
    localStorage.setItem(
      `pstdio-project-settings/projects/${currentProjectId}/values`,
      JSON.stringify({ state: { sessionModalState: "closed", selectedSessionId: null }, version: 0 }),
    );
  }, projectId);
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string };
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];

  for (const project of projects) {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
};

const createGitRepo = () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-perf-repo-"));
  execSync("git init -b main", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "perf fixture\n");
  execSync("git add README.md", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

test.describe("frontend route performance", () => {
  const sessionsReadySamples: number[] = [];
  const workspaceReadySamples: number[] = [];
  const workspaceLongTaskSamples: number[] = [];
  const workspaceInteractionSamples: number[] = [];
  const repoDirs: string[] = [];

  test.afterEach(() => {
    for (const dir of repoDirs) rmSync(dir, { recursive: true, force: true });
    repoDirs.length = 0;
  });

  test.afterAll(() => {
    console.info("sessions-ready", calculateStats(sessionsReadySamples));
    console.info("workspace-ready", calculateStats(workspaceReadySamples));
    console.info("workspace-long-tasks", calculateStats(workspaceLongTaskSamples));
    console.info("workspace-interaction", calculateStats(workspaceInteractionSamples));
  });

  test("sessions shell is ready within budget", async ({ page, request }) => {
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Perf Sessions");
    await bypassOnboarding(page, project.id);
    await installLongTaskObserver(page);
    await throttleChromiumCpu(page);

    await page.goto("/");
    await navigateForRouteMeasure(page, `/projects/${project.id}/sessions`, "route:sessions:start");
    const ready = await waitForMark(page, "app:sessions-page-ready", "route:sessions:start");

    sessionsReadySamples.push(ready);
    expect(calculateStats(sessionsReadySamples).p95).toBeLessThanOrEqual(2_000);
  });

  test("workspace shell with a large diff is ready within budget", async ({ page, request }) => {
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Perf Workspace");
    const repoRoot = createGitRepo();
    repoDirs.push(repoRoot);
    const repoRes = await request.post(`${apiBase}/v1/projects/${project.id}/repos`, {
      data: { name: "perf", path: repoRoot },
    });
    expect(repoRes.ok()).toBe(true);
    const repo = (await repoRes.json()) as { id: string };
    const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "# Perf" });
    const attempt = await createPlannerAttempt(request, apiBase, project.id, {
      ticketId: ticket.id,
      repoId: repo.id,
      mode: "worktree",
      startSession: false,
    });
    writeFileSync(join(attempt.workspace.worktree_path, "large.txt"), "x\n".repeat(120_000));
    await bypassOnboarding(page, project.id);
    await installLongTaskObserver(page);
    await throttleChromiumCpu(page);

    await page.goto("/");
    await navigateForRouteMeasure(
      page,
      `/projects/${project.id}/tickets/${ticket.shorthand}/workspaces/${attempt.workspace.workspace_shorthand}`,
      "route:workspace:start",
    );
    const ready = await waitForMark(page, "app:workspace-page-ready", "route:workspace:start");
    const longTasks = await getTotalLongTaskDuration(page);
    const loadButton = page.getByRole("button", { name: "Load diff" }).first();
    await loadButton.waitFor({ state: "visible" });
    await markNow(page, "workspace:diff-file-open:start");
    await loadButton.click();
    await page.getByText("Large diffs are hidden by default").first().waitFor({ state: "visible" });
    await markNow(page, "workspace:diff-file-open:painted");
    const interaction = await waitForMark(page, "workspace:diff-file-open:painted", "workspace:diff-file-open:start");

    workspaceReadySamples.push(ready);
    workspaceLongTaskSamples.push(longTasks);
    workspaceInteractionSamples.push(interaction);
    expect(calculateStats(workspaceReadySamples).p95).toBeLessThanOrEqual(2_000);
    expect(calculateStats(workspaceLongTaskSamples).p75).toBeLessThanOrEqual(300);
    expect(calculateStats(workspaceInteractionSamples).p95).toBeLessThanOrEqual(350);
  });
});
