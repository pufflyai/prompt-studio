import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createWorktree, runHook } from "pstdio-wt";
import type { RouteDeps } from "../../deps";

type AttemptMode = "worktree" | "current_branch";
type WorkspaceRecord = Awaited<ReturnType<RouteDeps["workspaceService"]["create"]>>;

const resolveWorkspacesRoot = () => {
  const configured = process.env.PSTDIO_WORKSPACES_DIR?.trim();
  if (configured) return configured;

  const home = process.env.HOME?.trim();
  if (home) return join(home, ".pstdio", "workspaces");

  return join(homedir(), ".pstdio", "workspaces");
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
  deps: Pick<RouteDeps, "fileService" | "workspaceService">,
  input: {
    workspaceId: string;
    projectId: string;
    existingFileId: string | null;
    content: string;
  },
) => {
  const data = Buffer.from(input.content, "utf8");
  if (input.existingFileId) {
    const updated = await deps.fileService.update(input.existingFileId, { data });
    if (updated) return input.existingFileId;
  }

  const file = await deps.fileService.upload({
    project_id: input.projectId,
    file_name: "startup.log",
    file_kind: "startup_log",
    data,
    mime_type: "text/plain",
  });

  await deps.workspaceService.setStartupLogFileId(input.workspaceId, file.id);
  return file.id;
};

const runPostCreateHook = async (
  deps: Pick<RouteDeps, "fileService" | "workspaceService">,
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
  const payload = {
    repo_path: input.repoPath,
    worktree_path: input.worktreePath,
    branch: input.branch,
    workspace: input.workspace,
    workspace_id: input.workspaceId,
    ticket: input.ticketShorthand,
    project_id: input.projectId,
  };

  const result = await runHook("post-worktree-create", payload, { repoPath: input.repoPath });

  if (result.skipped) return { logFileId: input.existingStartupLogFileId, exitCode: 0, stderr: "" };

  const logContent = [result.stdout, result.stderr].filter(Boolean).join("\n");

  let logFileId = input.existingStartupLogFileId;
  if (logContent.length > 0) {
    try {
      logFileId = await saveHookLog(deps, {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        existingFileId: input.existingStartupLogFileId,
        content: logContent,
      });
    } catch {
      // keep existing log file ID
    }
  }

  return { logFileId, exitCode: result.exitCode, stderr: result.stderr };
};

export const resolveWorkspaceGitMetadata = async (input: {
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
  const payload = {
    repo_path: input.repoPath,
    worktree_path: worktreePath,
    branch,
    workspace: input.workspaceShorthand,
    ticket: input.ticketShorthand,
    project_id: input.projectId,
    base: input.base,
  };

  const preResult = await runHook("pre-worktree-create", payload, { repoPath: input.repoPath });
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

export const awaitPostCreateHook = async (
  deps: Pick<RouteDeps, "fileService" | "workspaceService" | "eventBus">,
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
    { fileService: deps.fileService, workspaceService: deps.workspaceService },
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

const emitTicketWorkspaceLink = async (deps: Pick<RouteDeps, "workspaceService" | "eventBus">, workspaceId: string) => {
  const ticketWorkspaceLink = await deps.workspaceService.getTicketWorkspaceLink(workspaceId);
  if (ticketWorkspaceLink) {
    deps.eventBus.emit("ticket_workspaces", "set", ticketWorkspaceLink);
  }
};

export const createAttemptWorkspace = async (
  deps: Pick<RouteDeps, "workspaceService" | "eventBus" | "fileService">,
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
  deps: Pick<RouteDeps, "fileService">,
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
  deps: Pick<RouteDeps, "agentConfigService">,
  requestedAgent: string | undefined,
) => {
  if (requestedAgent?.trim()) return requestedAgent.trim();

  const configs = await deps.agentConfigService.list();
  const defaultConfig = configs.find((config) => config.is_default) ?? configs[0];
  return defaultConfig?.agent_id ?? null;
};
