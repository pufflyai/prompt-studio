import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "@playwright/test";

let nextTicketNumber = 1;

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
  const shorthand = `PS-${nextTicketNumber++}`;
  const res = await request.post(
    `${apiBase}/v1/projects/${projectId}/extension-commands/pstdio.planner.createTicket/execute`,
    {
      data: {
        params: {
          shorthand,
          content,
          title: content.replace(/^#+\s*/, "").split("\n")[0],
        },
      },
    },
  );
  expect(res.ok()).toBe(true);
  return { id: shorthand, shorthand };
};

const getRepoPath = async (
  request: import("@playwright/test").APIRequestContext,
  apiBase: string,
  projectId: string,
  repoId: string,
) => {
  const res = await request.get(`${apiBase}/v1/projects/${projectId}/repos`);
  expect(res.ok()).toBe(true);
  const repos = (await res.json()) as { id: string; path: string }[];
  const repo = repos.find((candidate) => candidate.id === repoId);
  expect(repo).toBeTruthy();
  return repo!.path;
};

const createWorkspaceViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  apiBase: string,
  projectId: string,
  ticketId: string,
  repoId: string,
) => {
  const workspaceName = `${ticketId}_A1`;
  const repoPath = await getRepoPath(request, apiBase, projectId, repoId);
  const res = await request.post(`${apiBase}/v1/workspaces`, {
    data: {
      project_id: projectId,
      name: workspaceName,
      branch: `workspace/${workspaceName}`,
      worktree_path: repoPath,
      anchors: [
        {
          type: "pstdio.planner.ticket",
          id: ticketId,
          projectId,
          label: ticketId,
          extensionId: "pstdio.planner",
          role: "primary",
        },
      ],
    },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; workspace_shorthand: string };
};

export const createAttemptWithSessionViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  apiBase: string,
  projectId: string,
  ticketId: string,
  repoId: string,
  prompt: string,
) => {
  const workspace = await createWorkspaceViaApi(request, apiBase, projectId, ticketId, repoId);
  const res = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      project_id: projectId,
      agent: "fake",
      title: prompt,
      prompt,
      workspace_id: workspace.id,
    },
  });
  expect(res.ok()).toBe(true);
  const session = (await res.json()) as { id: string };
  return { workspace, session };
};
