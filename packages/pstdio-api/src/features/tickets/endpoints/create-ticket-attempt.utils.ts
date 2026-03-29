import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { eq, ticket_workspaces } from "pstdio-db";
import { createWorktree, runHook } from "pstdio-wt";
import type { RouteDeps } from "../../deps";
import { fireSessionStartHook, fireSessionStatusHook } from "../../sessions/session-hooks";
import { spawnAgentSession } from "../../sessions/spawn-agent";

type WorkspaceRecord = Awaited<ReturnType<RouteDeps["workspacesService"]["create"]>>;
type RepoRecord = Awaited<ReturnType<RouteDeps["reposService"]["listByProject"]>>[number];
type TicketRecord = NonNullable<Awaited<ReturnType<RouteDeps["ticketsService"]["get"]>>>;
type StartedAttemptSession = NonNullable<Awaited<ReturnType<typeof startAttemptSession>>>;
type AttemptMode = "worktree" | "current_branch";

type AttemptRequestInput = {
  agent?: string | null;
  base?: string | null;
  branch?: string | null;
  mode?: AttemptMode | null;
  model?: string | null;
  prompt?: string | null;
  repo_id?: string | null;
  repo_path?: string | null;
  start_session?: boolean | null;
};

type AttemptContextResult =
  | { error: { status: 404; message: string } }
  | {
      ticket: TicketRecord;
      repo: RepoRecord;
      mode: AttemptMode;
      base: string;
    };

type StartOptionalAttemptSessionResult =
  | { error: { status: 400; message: string } }
  | { started: StartedAttemptSession | null };

const resolveWorkspacesRoot = () => {
  const configured = process.env.PSTDIO_WORKSPACES_DIR?.trim();
  if (configured) return configured;

  const home = process.env.HOME?.trim();
  if (home) return join(home, ".pstdio", "workspaces");

  return join(homedir(), ".pstdio", "workspaces");
};

export const resolveAttemptBase = (input: { base?: string | null; branch?: string | null }) =>
  input.base?.trim() || input.branch?.trim() || "HEAD";

export const resolveSessionCwd = (input: {
  mode: AttemptMode;
  worktreeMode: AttemptMode;
  repoPath: string;
  worktreePath: string | null;
}) => (input.mode === input.worktreeMode ? (input.worktreePath ?? input.repoPath) : input.repoPath);

const resolveRepoForAttempt = async (deps: RouteDeps, projectId: string, input: AttemptRequestInput) => {
  const repos = await deps.reposService.listByProject(projectId);
  if (repos.length === 0) return null;

  if (input.repo_id) {
    return repos.find((repo) => repo.id === input.repo_id) ?? null;
  }

  if (input.repo_path) {
    return repos.find((repo) => repo.path === input.repo_path) ?? null;
  }

  return repos[0] ?? null;
};

const resolvePrompt = async (
  deps: Pick<RouteDeps, "filesService">,
  inputPrompt: string | null | undefined,
  fileId: string | null,
  fallbackTitle: string,
) => {
  const prompt = inputPrompt?.trim();
  if (prompt) return prompt;

  if (fileId) {
    const file = await deps.filesService.get(fileId);
    if (file && existsSync(file.storage_path)) {
      const content = readFileSync(file.storage_path, "utf8").trim();
      if (content.length > 0) return content;
    }
  }

  return fallbackTitle;
};

const resolveAgentId = async (deps: Pick<RouteDeps, "agentConfigsService">, requestedAgent: string | undefined) => {
  if (requestedAgent?.trim()) return requestedAgent.trim();

  const configs = await deps.agentConfigsService.list();
  const defaultConfig = configs.find((config) => config.is_default) ?? configs[0];
  return defaultConfig?.agent_id ?? null;
};

const copyPstdioConfig = async (repoPath: string, worktreePath: string) => {
  const srcConfig = join(repoPath, ".pstdio", "config.json");
  const dstConfig = join(worktreePath, ".pstdio", "config.json");
  if (existsSync(srcConfig) && !existsSync(dstConfig)) {
    await mkdir(join(worktreePath, ".pstdio"), { recursive: true });
    await copyFile(srcConfig, dstConfig);
  }
};

const saveHookLog = async (
  deps: Pick<RouteDeps, "filesService" | "workspacesService">,
  input: {
    workspaceId: string;
    projectId: string;
    existingFileId: string | null;
    content: string;
  },
) => {
  const data = Buffer.from(input.content, "utf8");
  if (input.existingFileId) {
    const updated = await deps.filesService.update(input.existingFileId, { data });
    if (updated) return input.existingFileId;
  }

  const file = await deps.filesService.upload({
    project_id: input.projectId,
    file_name: "startup.log",
    file_kind: "startup_log",
    data,
    mime_type: "text/plain",
  });

  await deps.workspacesService.setStartupLogFileId(input.workspaceId, file.id);
  return file.id;
};

const runPostCreateHook = async (
  deps: Pick<RouteDeps, "filesService" | "workspacesService">,
  input: {
    repoPath: string;
    worktreePath: string;
    branch: string;
    workspace: string;
    ticketShorthand: string;
    projectId: string;
    workspaceId: string;
    existingStartupLogFileId: string | null;
  },
) => {
  const result = await runHook(
    "post-worktree-create",
    {
      repoPath: input.repoPath,
      worktreePath: input.worktreePath,
      branch: input.branch,
      workspace: input.workspace,
      ticketShorthand: input.ticketShorthand,
      projectId: input.projectId,
    },
    input.repoPath,
  );

  if (result.skipped) return input.existingStartupLogFileId;

  const logContent = [result.stdout, result.stderr].filter(Boolean).join("\n");
  if (logContent.length === 0) return input.existingStartupLogFileId;

  try {
    return await saveHookLog(deps, {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      existingFileId: input.existingStartupLogFileId,
      content: logContent,
    });
  } catch {
    return input.existingStartupLogFileId;
  }
};

const emitTicketWorkspaceLink = async (deps: Pick<RouteDeps, "db" | "eventBus">, workspaceId: string) => {
  const [ticketWorkspaceLink] = await deps.db
    .select()
    .from(ticket_workspaces)
    .where(eq(ticket_workspaces.workspace_id, workspaceId));
  if (ticketWorkspaceLink) {
    deps.eventBus.emit("ticket_workspaces", "set", ticketWorkspaceLink);
  }
};

const resolveWorkspaceGitMetadata = async (input: {
  mode: AttemptMode;
  worktreeMode: AttemptMode;
  workspaceShorthand: string;
  repoPath: string;
  base: string;
  projectId: string;
  ticketShorthand: string;
}) => {
  if (input.mode !== input.worktreeMode) {
    return { branch: null as string | null, worktreePath: input.repoPath };
  }

  const branch = `workspace/${input.workspaceShorthand}`;
  const worktreePath = join(resolveWorkspacesRoot(), input.workspaceShorthand);

  const preResult = await runHook(
    "pre-worktree-create",
    {
      repoPath: input.repoPath,
      branch,
      workspace: input.workspaceShorthand,
      ticketShorthand: input.ticketShorthand,
      projectId: input.projectId,
    },
    input.repoPath,
  );
  if (!preResult.skipped && preResult.exitCode !== 0) {
    throw new Error(
      `HOOK pre-worktree-create FAILED (exit ${preResult.exitCode})\n${preResult.stderr || preResult.stdout}`,
    );
  }

  await createWorktree({
    repoRoot: input.repoPath,
    branch,
    path: worktreePath,
    base: input.base,
  });

  await copyPstdioConfig(input.repoPath, worktreePath);
  return { branch, worktreePath };
};

const awaitPostCreateHook = async (
  deps: Pick<RouteDeps, "filesService" | "workspacesService" | "eventBus">,
  input: {
    mode: AttemptMode;
    worktreeMode: AttemptMode;
    workspace: WorkspaceRecord;
    ticketShorthand: string;
    repoPath: string;
    branch: string | null;
  },
) => {
  if (input.mode !== input.worktreeMode || !input.workspace.worktree_path || !input.branch) {
    return;
  }

  const startupLogFileId = await runPostCreateHook(
    { filesService: deps.filesService, workspacesService: deps.workspacesService },
    {
      repoPath: input.repoPath,
      worktreePath: input.workspace.worktree_path,
      branch: input.branch,
      workspace: input.workspace.workspace_shorthand,
      ticketShorthand: input.ticketShorthand,
      projectId: input.workspace.project_id,
      workspaceId: input.workspace.id,
      existingStartupLogFileId: input.workspace.startup_log_file_id,
    },
  );

  if (startupLogFileId && startupLogFileId !== input.workspace.startup_log_file_id) {
    const current = await deps.workspacesService.get(input.workspace.id);
    if (current) deps.eventBus.emit("workspaces", "set", current);
  }
};

const startAttemptSession = async (
  deps: RouteDeps,
  input: {
    ticket: TicketRecord;
    workspace: WorkspaceRecord;
    requestedAgent: string | undefined;
    requestedModel: string | undefined;
    requestedPrompt: string | undefined;
  },
) => {
  const agentId = await resolveAgentId(deps, input.requestedAgent);
  if (!agentId) return null;

  const title = input.ticket.display_title ?? input.ticket.shorthand;
  const prompt = await resolvePrompt(deps, input.requestedPrompt, input.ticket.file_id, title);
  const session = await deps.sessionsService.create({
    project_id: input.ticket.project_id,
    title,
    agent: agentId,
  });
  deps.eventBus.emit("sessions", "set", session);

  const workspaceSessionLink = await deps.workspaceSessionsService.link(input.workspace.id, session.id);
  deps.eventBus.emit("workspace_sessions", "set", workspaceSessionLink);

  // Fire after the workspace-session link so the hook can resolve worktree context
  fireSessionStartHook(deps, { id: session.id, project_id: input.ticket.project_id, status: session.status });

  return { session, agentId, prompt, title };
};

const failStartedSession = async (deps: RouteDeps, sessionId: string) => {
  const failed = await deps.sessionsService.updateStatus(sessionId, "failed");
  if (failed) {
    deps.eventBus.emit("sessions", "set", failed);
    if (failed.project_id) {
      fireSessionStatusHook(deps, { id: failed.id, project_id: failed.project_id, status: failed.status });
    }
  }
};

const spawnStartedSession = (
  deps: RouteDeps,
  input: {
    session: StartedAttemptSession["session"];
    agentId: string;
    prompt: string;
    title: string;
    model: string | undefined;
    cwd: string;
  },
) => {
  void spawnAgentSession(
    {
      sessionId: input.session.id,
      agentId: input.agentId,
      prompt: input.prompt,
      title: input.title,
      model: input.model,
      cwd: input.cwd,
    },
    deps,
  ).catch(async () => {
    await failStartedSession(deps, input.session.id);
  });
};

const runSetupAndSpawnAgent = (
  deps: RouteDeps,
  input: {
    workspace: WorkspaceRecord;
    ticketShorthand: string;
    repoPath: string;
    mode: AttemptMode;
    worktreeMode: AttemptMode;
    session: StartedAttemptSession["session"] | null;
    agentId: string | null;
    prompt: string | null;
    title: string | null;
    model: string | undefined;
  },
) => {
  const run = async () => {
    await awaitPostCreateHook(deps, {
      mode: input.mode,
      worktreeMode: input.worktreeMode,
      workspace: input.workspace,
      ticketShorthand: input.ticketShorthand,
      repoPath: input.repoPath,
      branch: input.workspace.branch,
    });

    const ready = await deps.workspacesService.setInitializing(input.workspace.id, false);
    if (ready) deps.eventBus.emit("workspaces", "set", ready);

    if (input.session && input.agentId && input.prompt && input.title) {
      spawnStartedSession(deps, {
        session: input.session,
        agentId: input.agentId,
        prompt: input.prompt,
        title: input.title,
        model: input.model,
        cwd: resolveSessionCwd({
          mode: input.mode,
          worktreeMode: input.worktreeMode,
          repoPath: input.repoPath,
          worktreePath: input.workspace.worktree_path,
        }),
      });
    }
  };

  void run().catch(async () => {
    const cleared = await deps.workspacesService.setInitializing(input.workspace.id, false);
    if (cleared) deps.eventBus.emit("workspaces", "set", cleared);

    if (input.session) {
      await failStartedSession(deps, input.session.id);
    }
  });
};

export const resolveCreateTicketAttemptContext = async (
  deps: RouteDeps,
  ticketId: string,
  input: AttemptRequestInput,
  worktreeMode: AttemptMode,
): Promise<AttemptContextResult> => {
  const ticket = await deps.ticketsService.get(ticketId);
  if (!ticket) {
    return { error: { status: 404 as const, message: `Ticket not found: ${ticketId}` } };
  }

  const repo = await resolveRepoForAttempt(deps, ticket.project_id, input);
  if (!repo) {
    return { error: { status: 404 as const, message: `Repo not found for project ${ticket.project_id}` } };
  }

  return {
    ticket,
    repo,
    mode: input.mode ?? worktreeMode,
    base: resolveAttemptBase(input),
  };
};

export const createAttemptWorkspace = async (
  deps: Pick<RouteDeps, "workspacesService" | "eventBus" | "db" | "filesService">,
  input: {
    projectId: string;
    ticketId: string;
    ticketShorthand: string;
    mode: AttemptMode;
    worktreeMode: AttemptMode;
    repoPath: string;
    base: string;
  },
) => {
  const workspace = await deps.workspacesService.create({
    project_id: input.projectId,
    ticket_id: input.ticketId,
    ticket_shorthand: input.ticketShorthand,
  });
  deps.eventBus.emit("workspaces", "set", workspace);
  await emitTicketWorkspaceLink(deps, workspace.id);

  const gitMetadata = await resolveWorkspaceGitMetadata({
    mode: input.mode,
    worktreeMode: input.worktreeMode,
    workspaceShorthand: workspace.workspace_shorthand,
    repoPath: input.repoPath,
    base: input.base,
    projectId: input.projectId,
    ticketShorthand: input.ticketShorthand,
  });
  const workspaceWithGitMetadata =
    (await deps.workspacesService.updateGitMetadata(workspace.id, {
      branch: gitMetadata.branch,
      worktree_path: gitMetadata.worktreePath,
    })) ?? workspace;

  const needsHook = input.mode === input.worktreeMode && workspaceWithGitMetadata.worktree_path && gitMetadata.branch;
  if (!needsHook) {
    deps.eventBus.emit("workspaces", "set", workspaceWithGitMetadata);
    return workspaceWithGitMetadata;
  }

  const initializingWorkspace = await deps.workspacesService.setInitializing(workspace.id, true);
  if (!initializingWorkspace) {
    deps.eventBus.emit("workspaces", "set", workspaceWithGitMetadata);
    return workspaceWithGitMetadata;
  }

  deps.eventBus.emit("workspaces", "set", initializingWorkspace);
  return initializingWorkspace;
};

export const startOptionalAttemptSession = async (
  deps: RouteDeps,
  input: {
    ticket: TicketRecord;
    workspace: WorkspaceRecord;
    request: AttemptRequestInput;
  },
): Promise<StartOptionalAttemptSessionResult> => {
  if (!(input.request.start_session ?? true)) {
    return { started: null };
  }

  const started = await startAttemptSession(deps, {
    ticket: input.ticket,
    workspace: input.workspace,
    requestedAgent: input.request.agent ?? undefined,
    requestedModel: input.request.model ?? undefined,
    requestedPrompt: input.request.prompt ?? undefined,
  });

  if (!started) {
    return { error: { status: 400 as const, message: "No agent configured for ticket attempts." } };
  }

  return { started };
};

export const continueTicketAttemptSetup = (
  deps: RouteDeps,
  input: {
    workspace: WorkspaceRecord;
    ticketShorthand: string;
    repo: RepoRecord;
    mode: AttemptMode;
    worktreeMode: AttemptMode;
    started: StartedAttemptSession | null;
    model: string | undefined;
  },
) => {
  if (input.workspace.initializing) {
    runSetupAndSpawnAgent(deps, {
      workspace: input.workspace,
      ticketShorthand: input.ticketShorthand,
      repoPath: input.repo.path,
      mode: input.mode,
      worktreeMode: input.worktreeMode,
      session: input.started?.session ?? null,
      agentId: input.started?.agentId ?? null,
      prompt: input.started?.prompt ?? null,
      title: input.started?.title ?? null,
      model: input.model,
    });
    return;
  }

  if (!input.started) {
    return;
  }

  spawnStartedSession(deps, {
    session: input.started.session,
    agentId: input.started.agentId,
    prompt: input.started.prompt,
    title: input.started.title,
    model: input.model,
    cwd: resolveSessionCwd({
      mode: input.mode,
      worktreeMode: input.worktreeMode,
      repoPath: input.repo.path,
      worktreePath: input.workspace.worktree_path,
    }),
  });
};

export const buildCreateTicketAttemptResponse = (input: {
  mode: AttemptMode;
  ticket: TicketRecord;
  workspace: WorkspaceRecord;
  started: StartedAttemptSession | null;
}) => ({
  mode: input.mode,
  ticket: input.ticket,
  workspace: input.workspace,
  session: input.started
    ? {
        id: input.started.session.id,
        workspace_id: input.workspace.id,
        title: input.started.session.title,
        created_at: input.started.session.created_at,
        updated_at: input.started.session.updated_at,
      }
    : null,
});
