import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolvePstdioWorkspacesPath } from "pstdio-paths";
import { createWorktree, resolveLatestBase } from "pstdio-wt";
import { withHookSessionClient } from "../../hooks/hook-client";
import { isAgentEnabledForProject, parseProjectSelectedAgents } from "../../projects/selected-agents";
import type { TicketsRouteDeps } from "../deps";

type AttemptMode = "worktree" | "current_branch";
type WorkspaceRecord = Awaited<ReturnType<TicketsRouteDeps["workspaceService"]["create"]>>;

const resolveWorkspacesRoot = () => resolvePstdioWorkspacesPath({ env: process.env });

const copyPstdioConfig = async (repoPath: string, worktreePath: string) => {
  const srcConfig = join(repoPath, ".pstdio", "config.json");
  const dstConfig = join(worktreePath, ".pstdio", "config.json");
  if (existsSync(srcConfig) && !existsSync(dstConfig)) {
    await mkdir(join(worktreePath, ".pstdio"), { recursive: true });
    await copyFile(srcConfig, dstConfig);
  }
};

const runPostCreateHook = async (
  deps: Pick<TicketsRouteDeps, "fileService" | "workspaceService" | "pluginService">,
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
  const runtime = await deps.pluginService.getForProject(input.projectId);

  const hookContext = {
    projectId: input.projectId,
    repoPath: input.repoPath,
    worktreePath: input.worktreePath,
    branch: input.branch,
    workspace: input.workspace,
    workspaceId: input.workspaceId,
    ticket: input.ticketShorthand,
  };

  const ctx = { ...hookContext, client: withHookSessionClient(runtime.client, hookContext) };
  await runtime.hooks.firePost("postWorktreeCreate", ctx as never);

  return { logFileId: input.existingStartupLogFileId, exitCode: 0, stderr: "" };
};

export const resolveWorkspaceGitMetadata = async (
  deps: Pick<TicketsRouteDeps, "pluginService">,
  input: {
    mode: AttemptMode;
    worktreeMode: AttemptMode;
    workspaceShorthand: string;
    repoPath: string;
    base: string;
    projectId: string;
    ticketShorthand: string;
  },
) => {
  if (input.mode !== input.worktreeMode) {
    return { branch: null as string | null, worktreePath: input.repoPath };
  }

  const branch = `workspace/${input.workspaceShorthand}`;
  const worktreePath = join(resolveWorkspacesRoot(), input.workspaceShorthand);
  const base = await resolveLatestBase(input.repoPath, input.base);

  const runtime = await deps.pluginService.getForProject(input.projectId);
  const hookContext = {
    projectId: input.projectId,
    repoPath: input.repoPath,
    worktreePath,
    branch,
    workspace: input.workspaceShorthand,
    ticket: input.ticketShorthand,
    base,
  };

  const ctx = { ...hookContext, client: withHookSessionClient(runtime.client, hookContext) };
  const preResult = await runtime.hooks.firePre("preWorktreeCreate", ctx as never);
  if (preResult.rejected) {
    throw new Error(`HOOK preWorktreeCreate FAILED\n${preResult.reason ?? ""}`);
  }

  await createWorktree({
    repoRoot: input.repoPath,
    branch,
    path: worktreePath,
    base,
  });

  await copyPstdioConfig(input.repoPath, worktreePath);
  return { branch, worktreePath };
};

export const awaitPostCreateHook = async (
  deps: Pick<TicketsRouteDeps, "fileService" | "workspaceService" | "eventBus" | "pluginService">,
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

  const { logFileId, exitCode, stderr } = await runPostCreateHook(
    { fileService: deps.fileService, workspaceService: deps.workspaceService, pluginService: deps.pluginService },
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

  if (logFileId && logFileId !== input.workspace.startup_log_file_id) {
    const current = await deps.workspaceService.get(input.workspace.id);
    if (current) deps.eventBus.emit("workspaces", "set", current);
  }

  if (exitCode !== 0) {
    throw new Error(stderr || `Hook post-worktree-create failed (exit ${exitCode})`);
  }
};

const emitTicketWorkspaceLink = async (
  deps: Pick<TicketsRouteDeps, "workspaceService" | "eventBus">,
  workspaceId: string,
) => {
  const ticketWorkspaceLink = await deps.workspaceService.getTicketWorkspaceLink(workspaceId);
  if (ticketWorkspaceLink) {
    deps.eventBus.emit("ticket_workspaces", "set", ticketWorkspaceLink);
  }
};

export const createAttemptWorkspace = async (
  deps: Pick<TicketsRouteDeps, "workspaceService" | "eventBus" | "fileService" | "pluginService">,
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
  const workspace = await deps.workspaceService.create({
    project_id: input.projectId,
    ticket_id: input.ticketId,
    ticket_shorthand: input.ticketShorthand,
  });
  deps.eventBus.emit("workspaces", "set", workspace);
  await emitTicketWorkspaceLink(deps, workspace.id);

  const gitMetadata = await resolveWorkspaceGitMetadata(deps, {
    mode: input.mode,
    worktreeMode: input.worktreeMode,
    workspaceShorthand: workspace.workspace_shorthand,
    repoPath: input.repoPath,
    base: input.base,
    projectId: input.projectId,
    ticketShorthand: input.ticketShorthand,
  });
  const workspaceWithGitMetadata =
    (await deps.workspaceService.updateGitMetadata(workspace.id, {
      branch: gitMetadata.branch,
      worktree_path: gitMetadata.worktreePath,
    })) ?? workspace;

  const needsHook = input.mode === input.worktreeMode && workspaceWithGitMetadata.worktree_path && gitMetadata.branch;
  if (!needsHook) {
    deps.eventBus.emit("workspaces", "set", workspaceWithGitMetadata);
    return workspaceWithGitMetadata;
  }

  const initializingWorkspace = await deps.workspaceService.setInitializing(workspace.id, true);
  if (!initializingWorkspace) {
    deps.eventBus.emit("workspaces", "set", workspaceWithGitMetadata);
    return workspaceWithGitMetadata;
  }

  deps.eventBus.emit("workspaces", "set", initializingWorkspace);
  return initializingWorkspace;
};

export const resolvePrompt = async (
  deps: Pick<TicketsRouteDeps, "fileService">,
  inputPrompt: string | null | undefined,
  fileId: string | null,
  fallbackTitle: string,
) => {
  const prompt = inputPrompt?.trim();
  if (prompt) return prompt;

  if (fileId) {
    const file = await deps.fileService.get(fileId);
    if (file && existsSync(file.storage_path)) {
      const content = readFileSync(file.storage_path, "utf8").trim();
      if (content.length > 0) return content;
    }
  }

  return fallbackTitle;
};

export const resolveAgentId = async (
  deps: {
    agentConfigService: Pick<TicketsRouteDeps["agentConfigService"], "list">;
    projectService: {
      get: (projectId: string) => Promise<{ selected_agents?: string | null } | null>;
    };
  },
  requestedAgent: string | undefined,
  projectId: string,
) => {
  const project = await deps.projectService.get(projectId);

  if (requestedAgent?.trim()) {
    const normalizedAgent = requestedAgent.trim();
    if (project && !isAgentEnabledForProject(project, normalizedAgent)) {
      return null;
    }
    return normalizedAgent;
  }

  const configs = await deps.agentConfigService.list();
  const selectedAgents = project ? parseProjectSelectedAgents(project) : [];
  const availableConfigs =
    selectedAgents.length === 0 ? configs : configs.filter((config) => selectedAgents.includes(config.agent_id));
  const defaultConfig = availableConfigs.find((config) => config.is_default) ?? availableConfigs[0];
  return defaultConfig?.agent_id ?? null;
};
