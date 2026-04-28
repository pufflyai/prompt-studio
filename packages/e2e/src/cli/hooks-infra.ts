import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCliRunner, createGitRepo, createInitializedRepo as createRepoWithProject } from "./helpers";
import type { ApiInstance } from "./start-api";

export type HookTestContext = {
  api: ApiInstance;
  dirs: string[];
};

export const createRun = (ctx: HookTestContext) => createCliRunner(ctx.api.url).run;

export const createRunSafe = (ctx: HookTestContext) => createCliRunner(ctx.api.url).runSafe;

export const writePlugin = (repo: string, fileName: string, code: string) => {
  const pluginsDir = join(repo, ".pstdio", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(join(pluginsDir, fileName), code);
};

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

export const configureAgent = async (ctx: HookTestContext, agentId = "fake") => {
  await fetch(`${ctx.api.url}/v1/harnesses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ harness_id: agentId }),
  });
};

type WorkspaceRecord = {
  id: string;
  workspace_shorthand: string;
  branch: string | null;
  worktree_path: string | null;
};

type PlannerTicketRow = {
  id?: string;
  shorthand?: string;
  statusId?: string | null;
  archived?: boolean;
  content?: string;
};

const plannerCommandUrl = (ctx: HookTestContext, projectId: string, commandId: string) =>
  `${ctx.api.url}/v1/projects/${projectId}/extension-commands/pstdio.planner.${commandId}/execute`;

export const executePlannerCommand = async (
  ctx: HookTestContext,
  projectId: string,
  commandId: string,
  params: Record<string, unknown>,
) =>
  fetch(plannerCommandUrl(ctx, projectId, commandId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ params }),
  });

const listPlannerCollection = async <TValue>(ctx: HookTestContext, projectId: string, collection: string) => {
  const res = await fetch(
    `${ctx.api.url}/v1/projects/${projectId}/extensions/pstdio.planner/collections/${collection}`,
  );
  const body = (await res.json()) as {
    items: Array<{ item_id: string; value_json: TValue }>;
  };
  return body.items;
};

const createAnchoredWorkspace = async (ctx: HookTestContext, projectId: string, repo: string, name: string) => {
  const workspaceName = `${name
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toUpperCase()
    .slice(0, 16)}-A1`;
  const branch = `workspace/${workspaceName}`;
  execSync(`git checkout -B ${branch}`, { cwd: repo, stdio: "pipe" });

  const res = await fetch(`${ctx.api.url}/v1/workspaces`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      name: workspaceName,
      branch,
      worktree_path: repo,
      anchors: [
        {
          type: "pstdio.planner.ticket",
          id: `${workspaceName}:ticket`,
          projectId,
          label: workspaceName,
          extensionId: "pstdio.planner",
          role: "primary",
        },
      ],
    }),
  });

  if (res.status !== 201) {
    throw new Error(`Failed to create workspace: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as WorkspaceRecord;
};

export const createWorkspaceInRepo = async (ctx: HookTestContext, repo: string) => {
  const configPath = join(repo, ".pstdio", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8")) as { project_id: string };
  const workspace = await createAnchoredWorkspace(ctx, config.project_id, repo, "hook-test");

  return { workspace, ticketShorthand: workspace.workspace_shorthand };
};

export const createTicketViaApi = async (ctx: HookTestContext, projectId: string, prompt = "test ticket") => {
  const res = await executePlannerCommand(ctx, projectId, "createTicket", {
    content: `# ${prompt}\n`,
    title: prompt,
    user_prompt: prompt,
  });
  const body = (await res.json()) as { result: { id: string; shorthand: string; statusId: string | null } };
  return {
    res,
    ticket: { id: body.result.id, shorthand: body.result.shorthand, status_id: body.result.statusId },
  };
};

export const createSessionViaApi = async (ctx: HookTestContext, projectId: string, workspaceId?: string) => {
  const res = await fetch(`${ctx.api.url}/v1/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      title: "test",
      prompt: "test",
      agent: "fake",
      workspace_id: workspaceId,
    }),
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

  const workspace = await createAnchoredWorkspace(ctx, projectId, repo, name);
  const attemptRes = await fetch(`${ctx.api.url}/v1/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      title: "lifecycle test",
      prompt: "lifecycle test",
      agent: "fake",
      workspace_id: workspace.id,
    }),
  });
  const session = (await attemptRes.json()) as { id: string };
  const attempt = { workspace, session };

  return { attempt, projectId, attemptRes };
};

export const getAlternateStatusId = async (ctx: HookTestContext, projectId: string, currentStatusId: string | null) => {
  const statuses = await listPlannerStatuses(ctx, projectId);
  const other = statuses.find((s) => s.id !== currentStatusId);
  if (other) return other.id;

  const createRes = await executePlannerCommand(ctx, projectId, "createStatus", {
    name: "hook-test-status",
    color: "gray",
  });
  const created = (await createRes.json()) as { result: { id: string } };
  return created.result.id;
};

export const listPlannerStatuses = async (ctx: HookTestContext, projectId: string) => {
  const items = await listPlannerCollection<{ id?: string; name?: string }>(ctx, projectId, "statuses");
  return items.map((item) => ({
    id: item.value_json.id ?? item.item_id,
    name: item.value_json.name ?? item.item_id,
  }));
};

export const listPlannerTickets = async (ctx: HookTestContext, projectId: string) =>
  (await listPlannerCollection<PlannerTicketRow>(ctx, projectId, "tickets")).map((item) => ({
    id: item.value_json.id ?? item.item_id,
    shorthand: item.value_json.shorthand ?? item.item_id,
    status_id: item.value_json.statusId ?? null,
    archived: item.value_json.archived ?? false,
    content: item.value_json.content ?? "",
  }));

export const updatePlannerTicket = async (
  ctx: HookTestContext,
  projectId: string,
  ticketId: string,
  params: Record<string, unknown>,
) => executePlannerCommand(ctx, projectId, "updateTicket", { id: ticketId, ...params });

export const deletePlannerTicket = async (ctx: HookTestContext, projectId: string, ticketId: string) =>
  executePlannerCommand(ctx, projectId, "deleteTicket", { id: ticketId });

export const uploadPlannerTicketFile = async (
  ctx: HookTestContext,
  projectId: string,
  ticketId: string,
  fileName: string,
  content: string,
) =>
  executePlannerCommand(ctx, projectId, "uploadTicketFile", {
    ticket_id: ticketId,
    file_name: fileName,
    content_base64: Buffer.from(content).toString("base64"),
  });

export const readPlannerTicketContent = async (ctx: HookTestContext, projectId: string, ticketId: string) =>
  (await listPlannerTickets(ctx, projectId)).find((ticket) => ticket.id === ticketId || ticket.shorthand === ticketId)
    ?.content ?? "";

export const getTicket = async (ctx: HookTestContext, projectId: string, ticketId: string) => {
  const ticket = (await listPlannerTickets(ctx, projectId)).find(
    (candidate) => candidate.id === ticketId || candidate.shorthand === ticketId,
  );
  return ticket ?? { id: ticketId, shorthand: ticketId, status_id: null, archived: false, content: "" };
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
  const statuses = await listPlannerStatuses(ctx, projectId);
  return statuses.find((s) => s.id === statusId)?.name ?? null;
};

export const getAttemptStatusName = async (ctx: HookTestContext, projectId: string, statusId: string) => {
  const res = await fetch(`${ctx.api.url}/v1/projects/${projectId}/attempt-statuses`);
  const statuses = (await res.json()) as Array<{ id: string; name: string }>;
  return statuses.find((s) => s.id === statusId)?.name ?? null;
};

export const getStatusId = async (ctx: HookTestContext, projectId: string, name: string) => {
  const statuses = await listPlannerStatuses(ctx, projectId);
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
  mkdirSync(join(repo, ".pstdio", "plugins"), { recursive: true });
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
