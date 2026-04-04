import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createGitRepo, runPstdio, runPstdioSafe } from "./helpers";
import type { ApiInstance } from "./start-api";

export type HookTestContext = {
  api: ApiInstance;
  dirs: string[];
};

export const createRun = (ctx: HookTestContext) => (args: string, cwd: string) =>
  runPstdio(args, cwd, { PSTDIO_API_URL: ctx.api.url });

export const createRunSafe = (ctx: HookTestContext) => (args: string, cwd: string) =>
  runPstdioSafe(args, cwd, { PSTDIO_API_URL: ctx.api.url });

export const writeHook = (repo: string, hookName: string, script: string) => {
  const hooksDir = join(repo, ".pstdio", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const path = join(hooksDir, hookName);
  writeFileSync(path, `#!/bin/sh\n${script}`);
  chmodSync(path, 0o755);
};

export const createInitializedRepo = (ctx: HookTestContext, name: string) => {
  const repo = createGitRepo();
  ctx.dirs.push(repo);
  execSync("git commit --allow-empty -m init", { cwd: repo, stdio: "pipe" });
  createRun(ctx)(`projects create ${name}`, repo);
  return repo;
};

export const getProjectId = (repo: string) => {
  const configPath = join(repo, ".pstdio", "config.json");
  return (JSON.parse(readFileSync(configPath, "utf8")) as { project_id: string }).project_id;
};

export const registerRepo = async (ctx: HookTestContext, projectId: string, repo: string, name: string) => {
  await fetch(`${ctx.api.url}/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, path: repo }),
  });
};

export const configureAgent = async (ctx: HookTestContext, agentId = "fake") => {
  await fetch(`${ctx.api.url}/v1/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_id: agentId }),
  });
};

type WorkspaceRecord = {
  id: string;
  workspace_shorthand: string;
  branch: string | null;
  worktree_path: string | null;
};

export const createWorkspaceInRepo = async (ctx: HookTestContext, repo: string) => {
  const run = createRun(ctx);
  const createTicketOutput = run('tickets create --content "Hook test ticket"', repo);
  const ticketShorthand = createTicketOutput.match(/Created ticket (\S+)/)![1];

  run(`workspaces create --id ${ticketShorthand}`, repo);

  const configPath = join(repo, ".pstdio", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8")) as { project_id: string };

  const workspacesRes = await fetch(`${ctx.api.url}/v1/workspaces?project_id=${encodeURIComponent(config.project_id)}`);
  const workspaces = (await workspacesRes.json()) as WorkspaceRecord[];

  return { workspace: workspaces[0], ticketShorthand };
};

export const createTicketViaApi = async (ctx: HookTestContext, projectId: string, prompt = "test ticket") => {
  const res = await fetch(`${ctx.api.url}/v1/tickets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, user_prompt: prompt }),
  });
  return { res, ticket: (await res.json()) as { id: string; shorthand: string; status_id: string | null } };
};

export const createSessionViaApi = async (ctx: HookTestContext, projectId: string) => {
  const res = await fetch(`${ctx.api.url}/v1/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, title: "test", prompt: "test", agent: "fake" }),
  });
  return { res, session: (await res.json()) as { id: string } };
};

export const updateSessionStatus = async (ctx: HookTestContext, sessionId: string, status: string) => {
  return fetch(`${ctx.api.url}/v1/sessions/${sessionId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
};

export const createAttemptWithSession = async (ctx: HookTestContext, repo: string, name: string) => {
  const projectId = getProjectId(repo);
  await registerRepo(ctx, projectId, repo, name);
  await configureAgent(ctx);

  const run = createRun(ctx);
  const createTicketOutput = run('tickets create --content "lifecycle test"', repo);
  const ticketShorthand = createTicketOutput.match(/Created ticket (\S+)/)![1];

  const ticketRes = await fetch(`${ctx.api.url}/v1/tickets?project_id=${encodeURIComponent(projectId)}`);
  const tickets = (await ticketRes.json()) as Array<{ id: string; shorthand: string }>;
  const ticket = tickets.find((t) => t.shorthand === ticketShorthand)!;

  const attemptRes = await fetch(`${ctx.api.url}/v1/tickets/${ticket.id}/attempts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ start_session: true }),
  });

  const attempt = (await attemptRes.json()) as {
    workspace: { id: string; worktree_path: string | null; workspace_shorthand: string };
    session: { id: string } | null;
  };

  return { attempt, projectId, attemptRes };
};

export const getAlternateStatusId = async (ctx: HookTestContext, projectId: string, currentStatusId: string | null) => {
  const res = await fetch(`${ctx.api.url}/v1/projects/${projectId}/statuses`);
  const statuses = (await res.json()) as Array<{ id: string; name: string }>;
  const other = statuses.find((s) => s.id !== currentStatusId);
  if (other) return other.id;

  // No alternate exists — create one
  const createRes = await fetch(`${ctx.api.url}/v1/projects/${projectId}/statuses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "hook-test-status", color: "#000000" }),
  });
  const created = (await createRes.json()) as { id: string };
  return created.id;
};

export const getTicket = async (ctx: HookTestContext, ticketId: string) => {
  const res = await fetch(`${ctx.api.url}/v1/tickets/${ticketId}`);
  return (await res.json()) as { id: string; status_id: string | null; archived: boolean };
};

export const getWorkspace = async (ctx: HookTestContext, projectId: string, workspaceId: string) => {
  const res = await fetch(`${ctx.api.url}/v1/workspaces?project_id=${encodeURIComponent(projectId)}`);
  const workspaces = (await res.json()) as Array<{
    id: string;
    attempt_status_id: string | null;
    workspace_shorthand: string;
  }>;
  return workspaces.find((w) => w.id === workspaceId)!;
};

export const getStatusName = async (ctx: HookTestContext, projectId: string, statusId: string) => {
  const res = await fetch(`${ctx.api.url}/v1/projects/${projectId}/statuses`);
  const statuses = (await res.json()) as Array<{ id: string; name: string }>;
  return statuses.find((s) => s.id === statusId)?.name ?? null;
};

export const getAttemptStatusName = async (ctx: HookTestContext, projectId: string, statusId: string) => {
  const res = await fetch(`${ctx.api.url}/v1/projects/${projectId}/attempt-statuses`);
  const statuses = (await res.json()) as Array<{ id: string; name: string }>;
  return statuses.find((s) => s.id === statusId)?.name ?? null;
};

export const getStatusId = async (ctx: HookTestContext, projectId: string, name: string) => {
  const res = await fetch(`${ctx.api.url}/v1/projects/${projectId}/statuses`);
  const statuses = (await res.json()) as Array<{ id: string; name: string }>;
  return statuses.find((s) => s.name === name)?.id ?? null;
};

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const waitFor = async (predicate: () => boolean, timeoutMs = 5_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return true;
    }

    await wait(50);
  }

  return predicate();
};

export const waitForPath = async (path: string, timeoutMs = 5_000) => {
  return waitFor(() => existsSync(path), timeoutMs);
};

export const waitForJsonFile = async <T>(path: string, timeoutMs = 5_000) => {
  const ready = await waitFor(() => {
    if (!existsSync(path)) {
      return false;
    }

    try {
      JSON.parse(readFileSync(path, "utf8"));
      return true;
    } catch {
      return false;
    }
  }, timeoutMs);

  if (!ready) {
    throw new Error(`JSON file not ready within ${timeoutMs}ms: ${path}`);
  }

  return JSON.parse(readFileSync(path, "utf8")) as T;
};

/** Creates a bare git repo with one commit on main and a `.pstdio/` dir (for hooks). */
export const createRepoForWorktreeOps = (ctx: HookTestContext) => {
  const repo = createGitRepo();
  ctx.dirs.push(repo);
  writeFileSync(join(repo, "file.txt"), "initial");
  execSync("git add -A && git commit -m init", { cwd: repo, stdio: "pipe" });
  mkdirSync(join(repo, ".pstdio", "hooks"), { recursive: true });
  return repo;
};

/** Creates a feature branch off the current branch with one extra commit. */
export const createBranchWithCommit = (repo: string, branch: string, file: string, content: string) => {
  const baseBranch = execSync("git symbolic-ref --short HEAD", { cwd: repo, encoding: "utf8" }).trim();
  execSync(`git checkout -b ${branch}`, { cwd: repo, stdio: "pipe" });
  writeFileSync(join(repo, file), content);
  execSync(`git add -A && git commit -m "add ${file}"`, { cwd: repo, stdio: "pipe" });
  execSync(`git checkout ${baseBranch}`, { cwd: repo, stdio: "pipe" });
};

/** Creates a feature branch in a git worktree (needed for rebase tests). */
export const createWorktreeBranchWithCommit = (
  ctx: HookTestContext,
  repo: string,
  branch: string,
  file: string,
  content: string,
) => {
  const wtPath = join(repo, "..", `wt-${branch}`);
  execSync(`git worktree add -b ${branch} "${wtPath}"`, { cwd: repo, stdio: "pipe" });
  ctx.dirs.push(wtPath);
  writeFileSync(join(wtPath, file), content);
  execSync(`git add -A && git commit -m "add ${file}"`, { cwd: wtPath, stdio: "pipe" });
  return wtPath;
};

/** Adds a conflicting commit on the currently checked-out branch. */
export const createConflictOnMain = (repo: string, file: string, content: string) => {
  writeFileSync(join(repo, file), content);
  execSync(`git add -A && git commit -m "conflict on ${file}"`, { cwd: repo, stdio: "pipe" });
};
