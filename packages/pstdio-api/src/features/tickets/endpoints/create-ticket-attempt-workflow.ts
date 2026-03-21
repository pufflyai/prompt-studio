import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { eq, ticket_workspaces } from "pstdio-db";
import { createWorktree, runHook } from "pstdio-wt";
import type { RouteDeps } from "../../deps";
import { spawnAgentSession } from "../../sessions/spawn-agent";

const resolveWorkspacesRoot = () => {
  const configured = process.env.PSTDIO_WORKSPACES_DIR?.trim();
  if (configured) return configured;

  const home = process.env.HOME?.trim();
  if (home) return join(home, ".pstdio", "workspaces");

  return join(homedir(), ".pstdio", "workspaces");
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

export const createWorkspaceForAttempt = async (
  deps: Pick<RouteDeps, "workspacesService" | "eventBus" | "db">,
  input: {
    projectId: string;
    ticketId: string;
    ticketShorthand: string;
  },
) => {
  const workspace = await deps.workspacesService.create({
    project_id: input.projectId,
    ticket_id: input.ticketId,
    ticket_shorthand: input.ticketShorthand,
  });
  deps.eventBus.emit("workspaces", "set", workspace);

  const [ticketWorkspaceLink] = await deps.db
    .select()
    .from(ticket_workspaces)
    .where(eq(ticket_workspaces.workspace_id, workspace.id));
  if (ticketWorkspaceLink) {
    deps.eventBus.emit("ticket_workspaces", "set", ticketWorkspaceLink);
  }

  return workspace;
};

export const prepareWorkspaceForAttempt = async (
  deps: Pick<RouteDeps, "workspacesService" | "filesService" | "eventBus">,
  input: {
    mode: string;
    worktreeMode: string;
    base: string;
    repoPath: string;
    workspace: Awaited<ReturnType<RouteDeps["workspacesService"]["create"]>>;
  },
) => {
  let branch: string | null = null;
  let worktreePath = input.repoPath;

  if (input.mode === input.worktreeMode) {
    branch = `workspace/${input.workspace.workspace_shorthand}`;
    worktreePath = join(resolveWorkspacesRoot(), input.workspace.workspace_shorthand);

    await createWorktree({
      repoRoot: input.repoPath,
      branch,
      path: worktreePath,
      base: input.base,
    });

    await copyPstdioConfig(input.repoPath, worktreePath);
  }

  const workspaceWithGitMetadata =
    (await deps.workspacesService.updateGitMetadata(input.workspace.id, {
      branch,
      worktree_path: worktreePath,
    })) ?? input.workspace;
  deps.eventBus.emit("workspaces", "set", workspaceWithGitMetadata);

  if (input.mode === input.worktreeMode && workspaceWithGitMetadata.worktree_path && branch) {
    // Fire-and-forget: don't block the response on the post-create hook
    runPostCreateHook(
      { filesService: deps.filesService, workspacesService: deps.workspacesService },
      {
        repoPath: input.repoPath,
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

  return workspaceWithGitMetadata;
};

export const startAttemptSession = async (
  deps: Pick<
    RouteDeps,
    | "agentConfigsService"
    | "filesService"
    | "sessionsService"
    | "workspacesService"
    | "eventBus"
    | "agentRegistry"
    | "sessionStore"
  >,
  input: {
    workspace: Awaited<ReturnType<RouteDeps["workspacesService"]["create"]>>;
    mode: string;
    worktreeMode: string;
    repoPath: string;
    prompt: string | null | undefined;
    model: string | undefined;
    agent: string | undefined;
    ticket: {
      project_id: string;
      shorthand: string;
      display_title: string | null;
      file_id: string | null;
    };
  },
) => {
  const agentId = await resolveAgentId(deps, input.agent);
  if (!agentId) {
    return { error: "No agent configured for ticket attempts." as const };
  }

  const title = input.ticket.display_title ?? input.ticket.shorthand;
  const prompt = await resolvePrompt(deps, input.prompt, input.ticket.file_id, title);
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
      model: input.model,
      cwd,
    },
    deps,
  ).catch(async () => {
    const failed = await deps.sessionsService.updateStatus(session.id, "failed");
    if (failed) deps.eventBus.emit("sessions", "set", failed);
  });

  return { error: null, session, workspaceWithSession };
};
