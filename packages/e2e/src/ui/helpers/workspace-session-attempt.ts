import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { createPlannerAttempt, createPlannerTicket } from "../../helpers/planner-api";

export const createGitRepo = (prefix: string, readmeContent: string) => {
  const repoRoot = mkdtempSync(join(tmpdir(), prefix));
  execSync("git init", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), `${readmeContent}\n`);
  execSync("git add README.md", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

export const registerRepoViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  apiBase: string,
  projectId: string,
  name: string,
  path: string,
) => {
  const res = await request.post(`${apiBase}/v1/projects/${projectId}/repos`, {
    data: { name, path },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string };
};

export const createTicketViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  apiBase: string,
  projectId: string,
  content: string,
) => {
  return createPlannerTicket(request, apiBase, projectId, { content });
};

export const createAttemptWithSessionViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  apiBase: string,
  projectId: string,
  ticketId: string,
  repoId: string,
  _prompt: string,
) => {
  return createPlannerAttempt(request, apiBase, projectId, {
    ticketId,
    repoId,
    mode: "worktree",
    agent: { harnessId: "pstdio.workbench-fixture.harness.fake" },
  });
};
