import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { eq, ticket_workspaces } from "pstdio-db";
import { createWorktree, runHook } from "pstdio-wt";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { spawnAgentSession } from "../../sessions/spawn-agent";
import { createTicketAttemptBodySchema, notFoundResponseSchema, ticketAttemptResponseSchema } from "../dto";

const badRequestSchema = z.object({ error: z.string() });
type WorkspaceRecord = Awaited<ReturnType<RouteDeps["workspacesService"]["create"]>>;

const resolveWorkspacesRoot = () => {
  const configured = process.env.PSTDIO_WORKSPACES_DIR?.trim();
  if (configured) return configured;

  const home = process.env.HOME?.trim();
  if (home) return join(home, ".pstdio", "workspaces");

  return join(homedir(), ".pstdio", "workspaces");
};

export const createTicketAttemptRoute = createRoute({
  method: "post",
  path: "/tickets/{id}/attempts",
  description: "Create a ticket attempt workspace and optionally start a session.",
  tags: ["Tickets"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Ticket ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: createTicketAttemptBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Ticket attempt created.",
      content: { "application/json": { schema: ticketAttemptResponseSchema } },
    },
    400: {
      description: "Invalid request.",
      content: { "application/json": { schema: badRequestSchema } },
    },
    404: {
      description: "Ticket or repo not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

const resolveRepoForAttempt = async (
  deps: RouteDeps,
  projectId: string,
  input: { repo_id?: string; repo_path?: string },
) => {
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
    projectId: string;
    workspaceId: string;
    existingStartupLogFileId: string | null;
  },
) => {
  const result = await runHook(
    "post-create",
    {
      repoPath: input.repoPath,
      worktreePath: input.worktreePath,
      branch: input.branch,
      workspace: input.workspace,
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

const emitTicketWorkspaceLink = async (deps: Pick<RouteDeps, "db" | "eventBus">, input: { workspaceId: string }) => {
  const [ticketWorkspaceLink] = await deps.db
    .select()
    .from(ticket_workspaces)
    .where(eq(ticket_workspaces.workspace_id, input.workspaceId));
  if (ticketWorkspaceLink) {
    deps.eventBus.emit("ticket_workspaces", "set", ticketWorkspaceLink);
  }
};

const resolveWorkspaceGitMetadata = async (input: {
  mode: string;
  worktreeMode: string;
  workspaceShorthand: string;
  repoPath: string;
  base: string;
}) => {
  if (input.mode !== input.worktreeMode) {
    return { branch: null as string | null, worktreePath: input.repoPath };
  }

  const branch = `workspace/${input.workspaceShorthand}`;
  const worktreePath = join(resolveWorkspacesRoot(), input.workspaceShorthand);

  await createWorktree({
    repoRoot: input.repoPath,
    branch,
    path: worktreePath,
    base: input.base,
  });

  await copyPstdioConfig(input.repoPath, worktreePath);
  return { branch, worktreePath };
};

const queuePostCreateHook = (
  deps: Pick<RouteDeps, "filesService" | "workspacesService" | "eventBus">,
  input: {
    mode: string;
    worktreeMode: string;
    workspace: WorkspaceRecord;
    repoPath: string;
    branch: string | null;
  },
) => {
  if (input.mode !== input.worktreeMode || !input.workspace.worktree_path || !input.branch) {
    return;
  }

  // Fire-and-forget: don't block the response on the post-create hook
  runPostCreateHook(
    { filesService: deps.filesService, workspacesService: deps.workspacesService },
    {
      repoPath: input.repoPath,
      worktreePath: input.workspace.worktree_path,
      branch: input.branch,
      workspace: input.workspace.workspace_shorthand,
      projectId: input.workspace.project_id,
      workspaceId: input.workspace.id,
      existingStartupLogFileId: input.workspace.startup_log_file_id,
    },
  ).then((startupLogFileId) => {
    if (startupLogFileId && startupLogFileId !== input.workspace.startup_log_file_id) {
      deps.eventBus.emit("workspaces", "set", {
        ...input.workspace,
        startup_log_file_id: startupLogFileId,
      });
    }
  });
};

const createAttemptWorkspace = async (
  deps: Pick<RouteDeps, "workspacesService" | "eventBus" | "db" | "filesService">,
  input: {
    projectId: string;
    ticketId: string;
    ticketShorthand: string;
    mode: string;
    worktreeMode: string;
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
  await emitTicketWorkspaceLink(deps, { workspaceId: workspace.id });

  const gitMetadata = await resolveWorkspaceGitMetadata({
    mode: input.mode,
    worktreeMode: input.worktreeMode,
    workspaceShorthand: workspace.workspace_shorthand,
    repoPath: input.repoPath,
    base: input.base,
  });
  const workspaceWithGitMetadata =
    (await deps.workspacesService.updateGitMetadata(workspace.id, {
      branch: gitMetadata.branch,
      worktree_path: gitMetadata.worktreePath,
    })) ?? workspace;
  deps.eventBus.emit("workspaces", "set", workspaceWithGitMetadata);

  queuePostCreateHook(deps, {
    mode: input.mode,
    worktreeMode: input.worktreeMode,
    workspace: workspaceWithGitMetadata,
    repoPath: input.repoPath,
    branch: gitMetadata.branch,
  });

  return workspaceWithGitMetadata;
};

const startAttemptSession = async (
  deps: RouteDeps,
  input: {
    ticket: {
      id: string;
      project_id: string;
      shorthand: string;
      display_title: string | null;
      file_id: string | null;
    };
    workspace: WorkspaceRecord;
    repoPath: string;
    mode: string;
    worktreeMode: string;
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

  const workspaceWithSession = (await deps.workspacesService.setSessionId(input.workspace.id, session.id)) ?? {
    ...input.workspace,
    session_id: session.id,
  };
  deps.eventBus.emit("workspaces", "set", workspaceWithSession);

  const cwd =
    input.mode === input.worktreeMode ? (workspaceWithSession.worktree_path ?? input.repoPath) : input.repoPath;

  spawnAgentSession(
    {
      sessionId: session.id,
      agentId,
      prompt,
      title,
      model: input.requestedModel,
      cwd,
    },
    deps,
  ).catch(async () => {
    const failed = await deps.sessionsService.updateStatus(session.id, "failed");
    if (failed) deps.eventBus.emit("sessions", "set", failed);
  });

  return { session, workspaceWithSession };
};

export const createTicketAttemptHandler = (deps: RouteDeps): AppRouteHandler<typeof createTicketAttemptRoute> => {
  const worktreeMode = "worktree";

  return async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const ticket = await deps.ticketsService.get(id);

    if (!ticket) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const mode = input.mode ?? worktreeMode;
    const repo = await resolveRepoForAttempt(deps, ticket.project_id, input);
    if (!repo) {
      return c.json({ error: `Repo not found for project ${ticket.project_id}` }, 404);
    }

    const base = input.base?.trim() || input.branch?.trim() || "HEAD";
    const workspaceWithGitMetadata = await createAttemptWorkspace(deps, {
      projectId: ticket.project_id,
      ticketId: ticket.id,
      ticketShorthand: ticket.shorthand,
      mode,
      worktreeMode,
      repoPath: repo.path,
      base,
    });

    const shouldStartSession = input.start_session ?? true;
    if (!shouldStartSession) {
      return c.json(
        {
          mode,
          ticket,
          workspace: workspaceWithGitMetadata,
          session: null,
        },
        201,
      );
    }

    const started = await startAttemptSession(deps, {
      ticket,
      workspace: workspaceWithGitMetadata,
      repoPath: repo.path,
      mode,
      worktreeMode,
      requestedAgent: input.agent,
      requestedModel: input.model ?? undefined,
      requestedPrompt: input.prompt ?? undefined,
    });
    if (!started) {
      return c.json({ error: "No agent configured for ticket attempts." }, 400);
    }

    return c.json(
      {
        mode,
        ticket,
        workspace: started.workspaceWithSession,
        session: {
          id: started.session.id,
          workspace_id: started.workspaceWithSession.id,
          title: started.session.title,
          created_at: started.session.created_at,
          updated_at: started.session.updated_at,
        },
      },
      201,
    );
  };
};
