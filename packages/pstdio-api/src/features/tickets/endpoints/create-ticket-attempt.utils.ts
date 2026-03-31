import type { RouteDeps } from "../../deps";
import { fireSessionStartHook } from "../../sessions/session-hooks";
import { spawnAgentSession } from "../../sessions/spawn-agent";
import { awaitPostCreateHook, resolveAgentId, resolvePrompt } from "./attempt-workspace-setup";

export { createAttemptWorkspace } from "./attempt-workspace-setup";

type WorkspaceRecord = Awaited<ReturnType<RouteDeps["workspaceService"]["create"]>>;
type RepoRecord = Awaited<ReturnType<RouteDeps["repoService"]["listByProject"]>>[number];
type TicketRecord = NonNullable<Awaited<ReturnType<RouteDeps["ticketService"]["get"]>>>;
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

// --- Pure resolvers ---

export const resolveAttemptBase = (input: { base?: string | null; branch?: string | null }) =>
  input.base?.trim() || input.branch?.trim() || "HEAD";

export const resolveSessionCwd = (input: {
  mode: AttemptMode;
  worktreeMode: AttemptMode;
  repoPath: string;
  worktreePath: string | null;
}) => (input.mode === input.worktreeMode ? (input.worktreePath ?? input.repoPath) : input.repoPath);

// --- Repo resolution ---

const resolveRepoForAttempt = async (deps: RouteDeps, projectId: string, input: AttemptRequestInput) => {
  const repos = await deps.repoService.listByProject(projectId);
  if (repos.length === 0) return null;

  if (input.repo_id) {
    return repos.find((repo) => repo.id === input.repo_id) ?? null;
  }

  if (input.repo_path) {
    return repos.find((repo) => repo.path === input.repo_path) ?? null;
  }

  return repos[0] ?? null;
};

// --- Session lifecycle ---

const startAttemptSession = async (
  deps: RouteDeps,
  input: {
    ticket: TicketRecord;
    workspace: WorkspaceRecord;
    cwd: string;
    requestedAgent: string | undefined;
    requestedModel: string | undefined;
    requestedPrompt: string | undefined;
  },
) => {
  const agentId = await resolveAgentId(deps, input.requestedAgent);
  if (!agentId) return null;

  const title = input.ticket.display_title ?? input.ticket.shorthand;
  const prompt = await resolvePrompt(deps, input.requestedPrompt, input.ticket.file_id, title);
  const session = await deps.sessionService.create({
    project_id: input.ticket.project_id,
    title,
    agent: agentId,
    cwd: input.cwd,
  });
  deps.eventBus.emit("sessions", "set", session);

  const workspaceSessionLink = await deps.workspaceSessionService.link(input.workspace.id, session.id);
  deps.eventBus.emit("workspace_sessions", "set", workspaceSessionLink);

  // Fire start hook after the workspace-session link so the hook can resolve worktree context.
  fireSessionStartHook(
    {
      reposService: deps.repoService,
      workspaceSessionsService: deps.workspaceSessionService,
      attemptStatusesService: deps.attemptStatusService,
    },
    { id: session.id, project_id: input.ticket.project_id, status: session.status },
  );

  return { session, agentId, prompt, title };
};

const failStartedSession = async (deps: RouteDeps, sessionId: string) => {
  await deps.sessionService.transitionStatus(sessionId, "failed");
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
  ).catch(async (err) => {
    console.error(`[attempt] agent spawn failed for session ${input.session.id}:`, err);
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

    const ready = await deps.workspaceService.setInitializing(input.workspace.id, false);
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

  void run().catch(async (err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[attempt] workspace setup failed for ${input.workspace.id}:`, err);

    const updated = await deps.workspaceService.setSetupError(input.workspace.id, message);
    if (updated) deps.eventBus.emit("workspaces", "set", updated);

    if (input.session) {
      await failStartedSession(deps, input.session.id);
    }
  });
};

// --- Exported orchestration ---

export const resolveCreateTicketAttemptContext = async (
  deps: RouteDeps,
  ticketId: string,
  input: AttemptRequestInput,
  worktreeMode: AttemptMode,
): Promise<AttemptContextResult> => {
  const ticket = await deps.ticketService.get(ticketId);
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

export const startOptionalAttemptSession = async (
  deps: RouteDeps,
  input: {
    ticket: TicketRecord;
    workspace: WorkspaceRecord;
    cwd: string;
    request: AttemptRequestInput;
  },
): Promise<StartOptionalAttemptSessionResult> => {
  if (!(input.request.start_session ?? true)) {
    return { started: null };
  }

  const started = await startAttemptSession(deps, {
    ticket: input.ticket,
    workspace: input.workspace,
    cwd: input.cwd,
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
