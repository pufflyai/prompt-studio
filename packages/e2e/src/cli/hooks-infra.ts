import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCliRunner, createGitRepo, createInitializedRepo as createRepoWithProject } from "./helpers";
import type { ApiInstance } from "./start-api";

export type HookTestContext = {
  api: ApiInstance;
  dirs: string[];
};

export const createRun = (ctx: HookTestContext) => createCliRunner(ctx.api.url).run;

export const createRunSafe = (ctx: HookTestContext) => createCliRunner(ctx.api.url).runSafe;

export const createInitializedRepo = (ctx: HookTestContext, name: string) => {
  return createRepoWithProject({
    name,
    dirs: ctx.dirs,
    run: createRun(ctx),
    withInitialCommit: true,
  });
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

type WorkspaceRecord = {
  id: string;
  workspace_shorthand: string;
  branch: string | null;
  worktree_path: string | null;
};

export const createWorkspaceInRepo = async (ctx: HookTestContext, repo: string) => {
  const run = createRun(ctx);
  const projectId = getProjectId(repo);
  const ticket = JSON.parse(run('tickets create --content "Hook test ticket"', repo)) as {
    id: string;
    shorthand: string;
  };

  const attemptRes = await fetch(
    `${ctx.api.url}/v1/projects/${encodeURIComponent(projectId)}/extensions/commands/pstdio-planner.run-attempt/execute`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "api",
        params: { ticket: ticket.id, mode: "worktree", startSession: false },
      }),
    },
  );
  if (!attemptRes.ok) throw new Error(`Failed to create planner workspace: ${await attemptRes.text()}`);

  const workspacesRes = await fetch(`${ctx.api.url}/v1/workspaces?project_id=${encodeURIComponent(projectId)}`);
  const workspaces = (await workspacesRes.json()) as WorkspaceRecord[];
  const workspace = workspaces.find((candidate) => candidate.workspace_shorthand.startsWith(`${ticket.shorthand}_A`));

  if (!workspace) {
    throw new Error(`Workspace not found for ticket ${ticket.shorthand}`);
  }

  return { workspace, ticketShorthand: ticket.shorthand };
};

export const createSessionViaApi = async (ctx: HookTestContext, projectId: string) => {
  const res = await fetch(`${ctx.api.url}/v1/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      title: "test",
      prompt: "test",
      agent: "pstdio.harness-lab.fake",
    }),
  });
  return { res, session: (await res.json()) as { id: string } };
};

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const waitFor = async (predicate: () => boolean | Promise<boolean>, timeoutMs = 5_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return true;
    }

    await wait(50);
  }

  return predicate();
};

export const updateSessionStatus = async (ctx: HookTestContext, sessionId: string, status: string) => {
  return fetch(`${ctx.api.url}/v1/sessions/${sessionId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
};

export const getWorkspace = async (ctx: HookTestContext, projectId: string, workspaceId: string) => {
  const res = await fetch(`${ctx.api.url}/v1/workspaces?project_id=${encodeURIComponent(projectId)}`);
  const workspaces = (await res.json()) as Array<{
    id: string;
    workspace_shorthand: string;
  }>;
  return workspaces.find((w) => w.id === workspaceId)!;
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

/** Creates a bare git repo with one commit on main. */
export const createRepoForWorktreeOps = (ctx: HookTestContext) => {
  const repo = createGitRepo();
  ctx.dirs.push(repo);
  writeFileSync(join(repo, "file.txt"), "initial");
  execSync("git add -A && git commit -m init", { cwd: repo, stdio: "pipe" });
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
