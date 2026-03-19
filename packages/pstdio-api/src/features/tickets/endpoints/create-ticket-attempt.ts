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

    const workspace = await deps.workspacesService.create({
      project_id: ticket.project_id,
      ticket_id: ticket.id,
      ticket_shorthand: ticket.shorthand,
    });
    deps.eventBus.emit("workspaces", "set", workspace);

    const [ticketWorkspaceLink] = await deps.db
      .select()
      .from(ticket_workspaces)
      .where(eq(ticket_workspaces.workspace_id, workspace.id));
    if (ticketWorkspaceLink) {
      deps.eventBus.emit("ticket_workspaces", "set", ticketWorkspaceLink);
    }

    const base = input.base?.trim() || input.branch?.trim() || "HEAD";
    let branch: string | null = null;
    let worktreePath = repo.path;

    if (mode === worktreeMode) {
      branch = `workspace/${workspace.workspace_shorthand}`;
      worktreePath = join(resolveWorkspacesRoot(), workspace.workspace_shorthand);

      await createWorktree({
        repoRoot: repo.path,
        branch,
        path: worktreePath,
        base,
      });

      await copyPstdioConfig(repo.path, worktreePath);
    }

    const workspaceWithGitMetadata =
      (await deps.workspacesService.updateGitMetadata(workspace.id, {
        branch,
        worktree_path: worktreePath,
      })) ?? workspace;
    deps.eventBus.emit("workspaces", "set", workspaceWithGitMetadata);

    if (mode === worktreeMode && workspaceWithGitMetadata.worktree_path && branch) {
      // Fire-and-forget: don't block the response on the post-create hook
      runPostCreateHook(
        { filesService: deps.filesService, workspacesService: deps.workspacesService },
        {
          repoPath: repo.path,
          worktreePath: workspaceWithGitMetadata.worktree_path,
          branch,
          workspace: workspaceWithGitMetadata.workspace_shorthand,
          projectId: workspaceWithGitMetadata.project_id,
          workspaceId: workspaceWithGitMetadata.id,
          existingStartupLogFileId: workspaceWithGitMetadata.startup_log_file_id,
        },
      ).then((startupLogFileId) => {
        if (startupLogFileId && startupLogFileId !== workspaceWithGitMetadata.startup_log_file_id) {
          deps.eventBus.emit("workspaces", "set", {
            ...workspaceWithGitMetadata,
            startup_log_file_id: startupLogFileId,
          });
        }
      });
    }

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

    const agentId = await resolveAgentId(deps, input.agent);
    if (!agentId) {
      return c.json({ error: "No agent configured for ticket attempts." }, 400);
    }

    const title = ticket.display_title ?? ticket.shorthand;
    const prompt = await resolvePrompt(deps, input.prompt, ticket.file_id, title);
    const session = await deps.sessionsService.create({
      project_id: ticket.project_id,
      title,
      agent: agentId,
    });
    deps.eventBus.emit("sessions", "set", session);

    const workspaceWithSession = (await deps.workspacesService.setSessionId(workspace.id, session.id)) ?? {
      ...workspaceWithGitMetadata,
      session_id: session.id,
    };
    deps.eventBus.emit("workspaces", "set", workspaceWithSession);

    const cwd = mode === worktreeMode ? (workspaceWithSession.worktree_path ?? repo.path) : repo.path;

    spawnAgentSession(
      {
        sessionId: session.id,
        agentId,
        prompt,
        title,
        model: input.model,
        cwd,
      },
      deps,
    ).catch(async () => {
      const failed = await deps.sessionsService.updateStatus(session.id, "failed");
      if (failed) deps.eventBus.emit("sessions", "set", failed);
    });

    return c.json(
      {
        mode,
        ticket,
        workspace: workspaceWithSession,
        session: {
          id: session.id,
          workspace_id: workspaceWithSession.id,
          title: session.title,
          created_at: session.created_at,
          updated_at: session.updated_at,
        },
      },
      201,
    );
  };
};
