import { ticketLogger } from "../../../lib/logger";
import { createSessionScheduler } from "../../sessions/session-scheduler";
import type { TicketsRouteDeps } from "../deps";
import { awaitPostCreateHook, resolveAgentId, resolvePrompt } from "./attempt-workspace-setup";

export { createAttemptWorkspace } from "./attempt-workspace-setup";

type WorkspaceRecord = Awaited<ReturnType<TicketsRouteDeps["workspaceService"]["create"]>>;
type RepoRecord = Awaited<ReturnType<TicketsRouteDeps["repoService"]["listByProject"]>>[number];
type TicketRecord = NonNullable<Awaited<ReturnType<TicketsRouteDeps["ticketService"]["get"]>>>;
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

type PendingAttemptSession = {
  agentId: string;
  model: string | undefined;
  prompt: string;
  title: string;
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
  | { pending: PendingAttemptSession | null; started: StartedAttemptSession | null };

type ResolveOptionalAttemptSessionResult =
  | { error: { status: 400; message: string } }
  | { pending: PendingAttemptSession | null };

export const resolveAttemptBase = (input: { base?: string | null; branch?: string | null }) =>
  input.base?.trim() || input.branch?.trim() || "HEAD";

export const resolveSessionCwd = (input: {
  mode: AttemptMode;
  worktreeMode: AttemptMode;
  repoPath: string;
  worktreePath: string | null;
}) => (input.mode === input.worktreeMode ? (input.worktreePath ?? input.repoPath) : input.repoPath);

const resolveRepoForAttempt = async (deps: TicketsRouteDeps, projectId: string, input: AttemptRequestInput) => {
  const repos = await deps.repoService.listByProject(projectId);
  if (repos.length === 0) return null;
  if (input.repo_id) return repos.find((repo) => repo.id === input.repo_id) ?? null;
  if (input.repo_path) return repos.find((repo) => repo.path === input.repo_path) ?? null;
  return repos[0] ?? null;
};

const resolvePendingAttemptSession = async (
  deps: TicketsRouteDeps,
  input: {
    ticket: TicketRecord;
    requestedAgent: string | undefined;
    requestedModel: string | undefined;
    requestedPrompt: string | undefined;
  },
) => {
  const agentId = await resolveAgentId(deps, input.requestedAgent, input.ticket.project_id);
  if (!agentId) return null;

  const title = input.ticket.display_title ?? input.ticket.shorthand;
  const prompt = await resolvePrompt(deps, input.requestedPrompt, input.ticket.file_id, title);
  return { agentId, model: input.requestedModel, prompt, title };
};

const linkAttemptSession = async (deps: TicketsRouteDeps, workspaceId: string, sessionId: string) => {
  const workspaceSessionLink = await deps.workspaceSessionService.link(workspaceId, sessionId);
  deps.eventBus.emit("workspace_sessions", "set", workspaceSessionLink);
};

const startAttemptSession = async (
  deps: TicketsRouteDeps,
  input: {
    ticket: TicketRecord;
    workspace: WorkspaceRecord;
    pending: PendingAttemptSession;
    cwd: string;
  },
) => {
  const session = await createSessionScheduler(deps).createAndStartSession({
    projectId: input.ticket.project_id,
    title: input.pending.title,
    agentId: input.pending.agentId,
    prompt: input.pending.prompt,
    model: input.pending.model,
    cwd: input.cwd,
    onBeforeStartedHook: (session) => linkAttemptSession(deps, input.workspace.id, session.id),
  });

  return { session, agentId: input.pending.agentId, prompt: input.pending.prompt, title: input.pending.title };
};

const runSetupAndStartSession = (
  deps: TicketsRouteDeps,
  input: {
    workspace: WorkspaceRecord;
    ticket: TicketRecord;
    ticketShorthand: string;
    repoPath: string;
    mode: AttemptMode;
    worktreeMode: AttemptMode;
    pending: PendingAttemptSession | null;
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
    if (!input.pending) return;

    await startAttemptSession(deps, {
      ticket: input.ticket,
      workspace: ready ?? input.workspace,
      pending: input.pending,
      cwd: resolveSessionCwd({
        mode: input.mode,
        worktreeMode: input.worktreeMode,
        repoPath: input.repoPath,
        worktreePath: input.workspace.worktree_path,
      }),
    });
  };

  void run().catch(async (err) => {
    const message = err instanceof Error ? err.message : String(err);
    ticketLogger.error(
      { err, event: "ticket_attempt.workspace_setup.error", workspace_id: input.workspace.id },
      "Ticket attempt workspace setup failed",
    );

    const updated = await deps.workspaceService.setSetupError(input.workspace.id, message);
    if (updated) deps.eventBus.emit("workspaces", "set", updated);
  });
};

export const resolveCreateTicketAttemptContext = async (
  deps: TicketsRouteDeps,
  ticketId: string,
  input: AttemptRequestInput,
  worktreeMode: AttemptMode,
): Promise<AttemptContextResult> => {
  const ticket = await deps.ticketService.get(ticketId);
  if (!ticket) return { error: { status: 404 as const, message: `Ticket not found: ${ticketId}` } };

  const repo = await resolveRepoForAttempt(deps, ticket.project_id, input);
  if (!repo) return { error: { status: 404 as const, message: `Repo not found for project ${ticket.project_id}` } };

  return { ticket, repo, mode: input.mode ?? worktreeMode, base: resolveAttemptBase(input) };
};

export const startOptionalAttemptSession = async (
  deps: TicketsRouteDeps,
  input: {
    ticket: TicketRecord;
    workspace: WorkspaceRecord;
    cwd: string;
    pending: PendingAttemptSession | null;
    request: AttemptRequestInput;
  },
): Promise<StartOptionalAttemptSessionResult> => {
  const pending = input.pending;
  if (!(input.request.start_session ?? true) || !pending) return { pending: null, started: null };
  if (input.workspace.setup_error) return { pending: null, started: null };
  if (input.workspace.initializing) return { pending, started: null };

  const started = await startAttemptSession(deps, {
    ticket: input.ticket,
    workspace: input.workspace,
    pending,
    cwd: input.cwd,
  });

  return { pending: null, started };
};

export const resolveOptionalAttemptSession = async (
  deps: TicketsRouteDeps,
  input: { ticket: TicketRecord; request: AttemptRequestInput },
): Promise<ResolveOptionalAttemptSessionResult> => {
  if (!(input.request.start_session ?? true)) return { pending: null };

  const pending = await resolvePendingAttemptSession(deps, {
    ticket: input.ticket,
    requestedAgent: input.request.agent ?? undefined,
    requestedModel: input.request.model ?? undefined,
    requestedPrompt: input.request.prompt ?? undefined,
  });

  if (!pending) return { error: { status: 400 as const, message: "No agent configured for ticket attempts." } };

  return { pending };
};

export const continueTicketAttemptSetup = (
  deps: TicketsRouteDeps,
  input: {
    workspace: WorkspaceRecord;
    ticket: TicketRecord;
    ticketShorthand: string;
    repo: RepoRecord;
    mode: AttemptMode;
    worktreeMode: AttemptMode;
    pending: PendingAttemptSession | null;
    started: StartedAttemptSession | null;
  },
) => {
  if (!input.workspace.initializing) return;

  runSetupAndStartSession(deps, {
    workspace: input.workspace,
    ticket: input.ticket,
    ticketShorthand: input.ticketShorthand,
    repoPath: input.repo.path,
    mode: input.mode,
    worktreeMode: input.worktreeMode,
    pending: input.pending,
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
        status: input.started.session.status,
        created_at: input.started.session.created_at,
        updated_at: input.started.session.updated_at,
      }
    : null,
});
