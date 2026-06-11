import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import type {
  ExtensionProjectContext,
  ExtensionSessionsApi,
  ExtensionWorkspace,
  RepoContext,
} from "@pstdio/sdk/extensions";
import { worktreeEvents } from "@pstdio/sdk/extensions";
import type { ExtensionCommandRecord, ExtensionSettingDefinitionRecord } from "pstdio-api-contracts";
import type {
  CommandRunnerEnvironment,
  RuntimeArtifactMount,
  RuntimeCommandRecord,
  RuntimeExtensionSettingRecord,
} from "pstdio-extensions";
import { createArtifactMount, loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";
import { ProjectNotFoundError } from "../../services/extension-service";
import { emitActivityEvent } from "../activity/activity-events";
import type { SessionsRouteDeps } from "../sessions/deps";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "../sessions/endpoints/resolve-create-session";
import { resolvePrompt } from "../sessions/resolve-prompt";
import { createSessionScheduler } from "../sessions/session-scheduler";
import { archiveWorkspaceCascade } from "../workspaces/archive-workspace-cascade";
import { setupWorkspaceWorktree } from "../workspaces/worktree-setup";
import type { ExtensionsRouteDeps } from "./deps";
// Deferred (runtime-only) use inside createExtensionWorkspace; event-runtime imports
// back from this module, so the cycle is safe as long as it is never read at module load.
import { fireExtensionEventAsync } from "./extension-event-runtime";
import { createExtensionWorktreesApi } from "./extension-worktree-environment";
import { createRepoFilesApi } from "./repo-files-api";

type EnabledSource = Awaited<
  ReturnType<ExtensionsRouteDeps["extensionService"]["listEnabledSourcesForProject"]>
>[number];
type CommandEnvironmentRuntimeDeps = {
  setupWorkspaceWorktree: typeof setupWorkspaceWorktree;
  fireExtensionEventAsync: typeof fireExtensionEventAsync;
};
type StorageApiInput = {
  extensionInstanceId: string;
  projectId: string;
  scopeType?: string;
  scopeId?: string;
};
type RuntimeStorageScope = Parameters<CommandRunnerEnvironment["storage"]["scope"]>[0];

// Built lazily (at call time, not module load): event-runtime and this module
// import each other, so reading fireExtensionEventAsync at module-eval time can hit
// its temporal dead zone when event-runtime is the entry of the import cycle.
const defaultCommandEnvironmentRuntimeDeps = (): CommandEnvironmentRuntimeDeps => ({
  setupWorkspaceWorktree,
  fireExtensionEventAsync,
});

export const loadProjectExtensionRuntime = async (deps: ExtensionsRouteDeps, projectId: string) => {
  const project = await deps.projectService.get(projectId);
  if (!project) throw new ProjectNotFoundError(projectId);
  const enabledSources = await deps.extensionService.listEnabledSourcesForProject(projectId);
  const repos = await deps.repoService.listByProject(projectId);
  const loaded = await loadExtensionSources({
    extensionPackages: enabledSources.map(({ installedSource }) => ({
      path: installedSource.source_path,
      sourceKind: installedSource.source_kind,
    })),
  });

  const runtime = normalizeExtensionSources(loaded.sources, loaded.diagnostics, {
    repoRoots: repos.map((repo) => repo.path).sort((left, right) => left.localeCompare(right)),
  });
  return {
    project: { id: project.id, name: project.name, shorthand: project.shorthand },
    enabledSources,
    runtime,
  };
};

export const toCommandRecord = (command: RuntimeCommandRecord): ExtensionCommandRecord => ({
  id: command.id,
  extensionId: command.extensionId,
  title: command.title,
  description: command.description,
  cliPath: command.cli?.pathKey,
  cliAliases: command.cli?.globalAliases?.map((alias) => alias.join(" ")),
  examples: command.cli?.examples,
  params: command.params as ExtensionCommandRecord["params"],
});

const findEnabledSource = (enabledSources: EnabledSource[], extensionId: string) =>
  enabledSources.find(({ installedSource }) => installedSource.extension_id === extensionId);

type ExtensionFileRow = NonNullable<Awaited<ReturnType<ExtensionsRouteDeps["fileService"]["get"]>>>;

const extensionFileUrl = (projectId: string, extensionInstanceId: string, fileId: string) =>
  `/v1/projects/${encodeURIComponent(projectId)}/extensions/${encodeURIComponent(extensionInstanceId)}/files/${encodeURIComponent(fileId)}/content`;

const toExtensionBlobRef = (projectId: string, extensionInstanceId: string, file: ExtensionFileRow) => ({
  id: file.id,
  name: file.file_name,
  mimeType: file.mime_type,
  size: file.size_bytes,
  hash: file.hash,
  url: extensionFileUrl(projectId, extensionInstanceId, file.id),
  createdAt: file.created_at,
  updatedAt: file.updated_at,
});

const toBuffer = (data: Uint8Array | ArrayBuffer) =>
  Buffer.from(data instanceof Uint8Array ? data : new Uint8Array(data));

const createExtensionBlobsApi = (
  deps: ExtensionsRouteDeps,
  input: {
    extensionInstanceId: string;
    projectId: string;
    scopeType: string;
    scopeId: string | null;
  },
): CommandRunnerEnvironment["storage"]["files"] => ({
  async put(fileInput) {
    const file = await deps.fileService.upload({
      project_id: input.projectId,
      file_name: fileInput.name,
      file_kind: "extension",
      data: toBuffer(fileInput.data),
      mime_type: fileInput.mimeType ?? null,
    });
    await deps.extensionFilesService.attach({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: file.id,
      scope_type: input.scopeType,
      scope_id: input.scopeId,
    });
    deps.eventBus?.emit("files", "set", file);
    return toExtensionBlobRef(input.projectId, input.extensionInstanceId, file);
  },
  async get(id) {
    const file = await deps.extensionFilesService.getOwnedFile({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: id,
    });
    return file ? toExtensionBlobRef(input.projectId, input.extensionInstanceId, file) : undefined;
  },
  async getBytes(id) {
    const file = await deps.extensionFilesService.getOwnedFile({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: id,
    });
    if (!file) throw new Error(`Extension file not found: ${id}`);
    return new Uint8Array(readFileSync(file.storage_path));
  },
  async list() {
    const files = await deps.extensionFilesService.list({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      scope_type: input.scopeType,
      scope_id: input.scopeId,
    });
    return files.map((file) => toExtensionBlobRef(input.projectId, input.extensionInstanceId, file));
  },
  async delete(id) {
    const file = await deps.extensionFilesService.getOwnedFile({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: id,
    });
    if (!file) return;
    await deps.extensionFilesService.detach({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: id,
    });
    await deps.fileService.remove(id);
    deps.eventBus?.emit("files", "delete", { id });
  },
  urlFor(id) {
    return extensionFileUrl(input.projectId, input.extensionInstanceId, id);
  },
});

const resolveStorageScopeInput = (input: StorageApiInput, nextScope: RuntimeStorageScope) => {
  if (nextScope.type === "project") return input;
  if (nextScope.type === "repo") {
    const repoId = "repoId" in nextScope ? nextScope.repoId : undefined;
    if (!repoId) throw new Error("repo storage scope requires repoId");
    return { ...input, scopeType: "repo", scopeId: repoId };
  }
  if (nextScope.type === "resource") {
    const resource = "resource" in nextScope ? nextScope.resource : undefined;
    if (!resource?.id) throw new Error("resource storage scope requires resource.id");
    return { ...input, scopeType: "resource", scopeId: resource.id };
  }
  const customId = "id" in nextScope ? nextScope.id : undefined;
  if (!customId) throw new Error(`${nextScope.type} storage scope requires id`);
  return { ...input, scopeType: nextScope.type, scopeId: customId };
};

const createStorageApi = (deps: ExtensionsRouteDeps, input: StorageApiInput) => {
  const scope = {
    extension_instance_id: input.extensionInstanceId,
    scope_type: input.scopeType ?? "project",
    scope_id: input.scopeId ?? input.projectId,
  };

  const api: CommandRunnerEnvironment["storage"] = {
    files: createExtensionBlobsApi(deps, {
      extensionInstanceId: input.extensionInstanceId,
      projectId: input.projectId,
      scopeType: scope.scope_type,
      scopeId: scope.scope_id,
    }),
    scope(nextScope) {
      return createStorageApi(deps, resolveStorageScopeInput(input, nextScope));
    },
    async get(key) {
      const row = await deps.extensionStorageService.getKv(scope, key);
      return row?.value_json as never;
    },
    async set(key, value) {
      await deps.extensionStorageService.setKv({ ...scope, key, value_json: value, project_id: input.projectId });
    },
    async delete(key) {
      await deps.extensionStorageService.deleteKv(scope, key);
    },
    collection(name) {
      return {
        async get(id) {
          const row = await deps.extensionStorageService.getCollectionItem({ ...scope, collection: name }, id);
          return row?.value_json as never;
        },
        async list() {
          const rows = await deps.extensionStorageService.listCollection({ ...scope, collection: name });
          return rows.map((row) => row.value_json) as never;
        },
        async put(id, value) {
          await deps.extensionStorageService.setCollectionItem({
            ...scope,
            collection: name,
            item_id: id,
            value_json: value,
            project_id: input.projectId,
          });
        },
        async create(value) {
          const id = crypto.randomUUID();
          await this.put(id, value);
          return { ...(typeof value === "object" && value !== null ? value : {}), id } as never;
        },
        async delete(id) {
          await deps.extensionStorageService.deleteCollectionItem({ ...scope, collection: name }, id);
        },
        attachments(itemId) {
          return createExtensionBlobsApi(deps, {
            extensionInstanceId: input.extensionInstanceId,
            projectId: input.projectId,
            scopeType: `collection:${name}`,
            scopeId: itemId,
          });
        },
      };
    },
  };

  return api;
};

const toSettingDefinition = (setting: RuntimeExtensionSettingRecord): ExtensionSettingDefinitionRecord => ({
  key: setting.key,
  extensionId: setting.extensionId,
  type: setting.contribution.type,
  scope: setting.contribution.scope,
  default: setting.contribution.default,
  enum: setting.contribution.enum,
  title: setting.contribution.title,
  description: setting.contribution.description,
});

const createSettingsApi = (
  deps: ExtensionsRouteDeps,
  input: {
    extensionId: string;
    extensionInstanceId: string;
    installedExtensionId: string;
    settings?: RuntimeExtensionSettingRecord[];
  },
): CommandRunnerEnvironment["settings"] => {
  const context = {
    extensionId: input.extensionId,
    extensionInstanceId: input.extensionInstanceId,
    installedExtensionId: input.installedExtensionId,
    definitions: (input.settings ?? []).map(toSettingDefinition),
  };

  return {
    async all() {
      const records = await deps.extensionSettingsService.list(context);
      return Object.fromEntries(records.map((record) => [record.key, record.value]));
    },
    async get(key) {
      const record = await deps.extensionSettingsService.get(context, String(key));
      return record.value as never;
    },
    async set(key, value) {
      await deps.extensionSettingsService.set(context, String(key), value);
    },
    async delete(key) {
      await deps.extensionSettingsService.delete(context, String(key));
    },
  };
};

const createFilesApi = (deps: ExtensionsRouteDeps, projectId: string): CommandRunnerEnvironment["files"] => ({
  async readText(fileId) {
    const file = await deps.fileService.get(fileId);
    if (!file) throw new Error(`File not found: ${fileId}`);
    return readFileSync(file.storage_path, "utf8");
  },
  async writeText(fileId, value) {
    await deps.fileService.update(fileId, { data: Buffer.from(value, "utf8") });
  },
  async createText(input) {
    const file = await deps.fileService.upload({
      project_id: projectId,
      file_name: input.name,
      file_kind: "extension",
      data: Buffer.from(input.content, "utf8"),
      mime_type: "text/plain",
    });
    return { id: file.id };
  },
  async delete(fileId) {
    await deps.fileService.remove(fileId);
  },
});

const createReposApi = (deps: ExtensionsRouteDeps, projectId: string): CommandRunnerEnvironment["repos"] => {
  const toContext = (repo: { id: string; path: string }, role?: "default") => ({
    projectId,
    repoId: repo.id,
    path: repo.path,
    role,
  });

  return {
    async list() {
      const repos = await deps.repoService.listByProject(projectId);
      return repos.map((repo, index) => toContext(repo, index === 0 ? "default" : undefined));
    },
    async get(repoId) {
      const repo = await deps.repoService.get(repoId);
      if (!repo) throw new Error(`Repo not found: ${repoId}`);
      return toContext(repo);
    },
    async getDefault() {
      const [repo] = await deps.repoService.listByProject(projectId);
      return repo ? toContext(repo, "default") : undefined;
    },
    async resolvePath(repoId, relativePath) {
      const repo = await deps.repoService.get(repoId);
      if (!repo) throw new Error(`Repo not found: ${repoId}`);
      return join(repo.path, relativePath);
    },
  };
};

const findFreePort = (host = "127.0.0.1") =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a free port")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });

// Resolves the on-disk path of a repo from the registered project repos, never
// trusting a client-supplied path. The repo must be registered for the project,
// guarding ctx.repoFiles against forged execute requests pointing outside it.
const resolveRegisteredRepoPath = async (deps: ExtensionsRouteDeps, projectId: string, repo: RepoContext) => {
  const repos = await deps.repoService.listByProject(projectId);
  const registered = repos.find((candidate) => candidate.id === repo.repoId);
  if (!registered) throw new Error(`Repo ${repo.repoId} is not registered for project ${projectId}`);
  return registered.path;
};

const createArtifactsApi = (
  deps: ExtensionsRouteDeps,
  input: {
    artifactMounts?: RuntimeArtifactMount[];
    extensionId: string;
    name: string;
    projectId: string;
  },
): CommandRunnerEnvironment["artifacts"] => {
  const resolveMount = (key: string) => {
    const mount = (input.artifactMounts ?? []).find(
      (candidate) => candidate.extensionId === input.extensionId && (candidate.localId === key || candidate.id === key),
    );
    if (!mount) throw new Error(`Artifact mount not found: ${key}`);
    return mount;
  };

  const createForDefaultRepo = async (mount: RuntimeArtifactMount) => {
    const [repo] = await deps.repoService.listByProject(input.projectId);
    if (!repo) throw new Error(`Repo not found for project: ${input.projectId}`);
    return createArtifactMount({ repoRoot: repo.path, name: mount.name, mountPath: mount.relativePath });
  };

  return {
    mount(key) {
      const mount = resolveMount(key);
      const mountFor = () => createForDefaultRepo(mount);

      return {
        exists: async (path) => (await mountFor()).exists(path),
        readText: async (path) => (await mountFor()).readText(path),
        writeText: async (path, value) => (await mountFor()).writeText(path, value),
        readBytes: async (path) => (await mountFor()).readBytes(path),
        writeBytes: async (path, value) => (await mountFor()).writeBytes(path, value),
        list: async (pattern) => (await mountFor()).list(pattern),
        listDirs: async (path) => (await mountFor()).listDirs(path),
        delete: async (path) => (await mountFor()).delete(path),
      };
    },
  };
};

const resolveExtensionPrompt = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  input: { prompt?: string; template?: string; vars?: Record<string, unknown> },
) =>
  resolvePrompt(
    {
      prompt: input.prompt,
      template: input.template,
      vars: input.vars as Record<string, string> | undefined,
    },
    projectId,
    deps as SessionsRouteDeps,
  );

const processOutput = (result: { stdout: string; stderr: string }) =>
  [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");

const createProcessApi = (): CommandRunnerEnvironment["process"] => {
  const api: CommandRunnerEnvironment["process"] = {
    async run(input) {
      const proc = Bun.spawn(input.command, {
        cwd: input.cwd,
        env: input.env ? { ...process.env, ...input.env } : process.env,
        stderr: "pipe",
        stdout: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      return { exitCode, stdout, stderr };
    },
    async runOrThrow(input) {
      const result = await api.run(input);
      if (result.exitCode === 0) return result;

      throw new Error(processOutput(result) || `Command failed: ${input.command.join(" ")}`);
    },
    async spawnDetached(input) {
      const proc = Bun.spawn(input.command, {
        cwd: input.cwd,
        env: input.env ? { ...process.env, ...input.env } : process.env,
        stderr: "ignore",
        stdout: "ignore",
      });
      return { pid: proc.pid };
    },
  };

  return api;
};

const resolveHarnessInput = (harness: unknown) => {
  if (!harness || typeof harness !== "object") return {};
  const input = harness as { harnessId?: unknown; model?: unknown };
  return {
    agent: typeof input.harnessId === "string" ? input.harnessId : undefined,
    model: typeof input.model === "string" ? input.model : undefined,
  };
};

const metadataShorthand = (metadata: Record<string, unknown> | undefined) => {
  const shorthand = metadata?.shorthand;
  return typeof shorthand === "string" ? shorthand : undefined;
};

const ticketShorthandFromAnchors = (
  anchors: { type: string; label?: string; metadata?: Record<string, unknown> }[],
) => {
  const ticket = anchors.find((anchor) => anchor.type === "ticket");
  return metadataShorthand(ticket?.metadata) ?? ticket?.label ?? null;
};

const toExtensionSession = (session: unknown) => session as Awaited<ReturnType<ExtensionSessionsApi["get"]>>;

const resolveRepoForWorkspace = async (deps: ExtensionsRouteDeps, projectId: string, repoId: unknown) => {
  const repos = await deps.repoService.listByProject(projectId);
  if (repos.length === 0) throw new Error(`Repo not found for project ${projectId}`);
  if (typeof repoId === "string" && repoId.trim()) {
    const repo = repos.find((candidate) => candidate.id === repoId);
    if (!repo) throw new Error(`Repo not found: ${repoId}`);
    return repo;
  }
  return repos[0]!;
};

const createExtensionWorkspace = async (
  deps: ExtensionsRouteDeps,
  input: {
    projectId: string;
    workspaceInput: Record<string, unknown>;
  },
  runtimeDeps: CommandEnvironmentRuntimeDeps,
) => {
  const projectId =
    typeof input.workspaceInput.project_id === "string" ? input.workspaceInput.project_id : input.projectId;
  const anchors = Array.isArray(input.workspaceInput.anchors) ? (input.workspaceInput.anchors as never[]) : [];
  const shorthandBase =
    typeof input.workspaceInput.shorthand_base === "string"
      ? input.workspaceInput.shorthand_base
      : (ticketShorthandFromAnchors(anchors) ?? undefined);
  if (!shorthandBase) throw new Error("Workspace creation requires shorthand_base");

  const mode = input.workspaceInput.mode === "current_branch" ? "current_branch" : "worktree";
  const repo = await resolveRepoForWorkspace(deps, projectId, input.workspaceInput.repo_id);
  const workspace = await deps.workspaceService.create({
    project_id: projectId,
    shorthand_base: shorthandBase,
    anchors,
  });

  if (mode === "current_branch") {
    const updated =
      (await deps.workspaceService.updateGitMetadata(workspace.id, {
        branch: null,
        worktree_path: repo.path,
      })) ?? workspace;
    deps.eventBus.emit("workspaces", "set", updated);
    return updated;
  }

  try {
    const { branch, worktreePath } = await runtimeDeps.setupWorkspaceWorktree({
      repoPath: repo.path,
      workspaceShorthand: workspace.workspace_shorthand,
      base: typeof input.workspaceInput.base === "string" ? input.workspaceInput.base : "HEAD",
    });
    const updated =
      (await deps.workspaceService.updateGitMetadata(workspace.id, { branch, worktree_path: worktreePath })) ??
      workspace;
    deps.eventBus.emit("workspaces", "set", updated);
    // Mirror the standalone create-workspace endpoint so worktree-bootstrap hooks
    // (agent/.pstdio config copy) run for extension-created attempts too.
    runtimeDeps.fireExtensionEventAsync(deps, projectId, worktreeEvents.created, {
      projectId,
      repoPath: repo.path,
      worktreePath,
      branch,
      workspace: updated.workspace_shorthand,
      workspaceId: updated.id,
    });
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = (await deps.workspaceService.setSetupError(workspace.id, message)) ?? workspace;
    deps.eventBus.emit("workspaces", "set", failed);
    return failed;
  }
};

export const createCommandEnvironment = (
  deps: ExtensionsRouteDeps,
  enabledSources: EnabledSource[],
  input: {
    artifactMounts?: RuntimeArtifactMount[];
    extensionId: string;
    name: string;
    project: ExtensionProjectContext;
    projectId: string;
    repo?: RepoContext;
    settings?: RuntimeExtensionSettingRecord[];
  },
  runtimeDeps = defaultCommandEnvironmentRuntimeDeps(),
): CommandRunnerEnvironment => {
  const enabledSource = findEnabledSource(enabledSources, input.extensionId);
  if (!enabledSource) throw new Error(`Enabled extension instance not found: ${input.extensionId}`);

  const storage = createStorageApi(deps, {
    extensionInstanceId: enabledSource.instance.id,
    projectId: input.projectId,
  });
  const settings = createSettingsApi(deps, {
    extensionId: input.extensionId,
    extensionInstanceId: enabledSource.instance.id,
    installedExtensionId: enabledSource.installedSource.id,
    settings: input.settings,
  });

  return {
    project: input.project,
    storage,
    artifacts: createArtifactsApi(deps, input),
    repoFiles: input.repo
      ? createRepoFilesApi(() => resolveRegisteredRepoPath(deps, input.projectId, input.repo as RepoContext))
      : undefined,
    files: createFilesApi(deps, input.projectId),
    sessions: {
      get: async (id) => toExtensionSession(await deps.sessionService.get(id)),
      create: async (sessionInput) => {
        const workspace =
          sessionInput.workspaceId != null
            ? ((await deps.workspaceService.get(sessionInput.workspaceId)) ??
              (await deps.workspaceService.getByShorthand(input.projectId, sessionInput.workspaceId)))
            : null;
        const repoPath = sessionInput.repoId ? (await deps.repoService.get(sessionInput.repoId))?.path : undefined;
        const project = await deps.projectService.get(input.projectId);
        if (!project) throw new Error(`Project not found: ${input.projectId}`);

        const harness = resolveHarnessInput(sessionInput.harness);
        const resolvedAgent = await resolveCreateSessionAgent(harness.agent, project, deps.harnessRegistry);

        if (resolvedAgent.type === "error") {
          throw new Error(resolvedAgent.error);
        }

        if (!resolvedAgent.agentId) {
          throw new Error("No harness available. Install and enable a harness extension first.");
        }

        const model = await resolveCreateSessionModel(
          harness.model,
          project,
          resolvedAgent.agentId,
          deps.harnessRegistry,
          {
            requestAgentWasOmitted: !harness.agent,
          },
        );
        const prompt = await resolveExtensionPrompt(deps, input.projectId, sessionInput);
        const cwd = repoPath ?? workspace?.worktree_path ?? undefined;
        const session = await createSessionScheduler(deps as SessionsRouteDeps).createAndStartSession({
          projectId: input.projectId,
          title: sessionInput.title,
          agentId: resolvedAgent.agentId,
          prompt,
          model,
          originalSessionId: sessionInput.originalSessionId,
          cwd,
          anchors: sessionInput.anchors,
          onBeforeStartedHook: async (createdSession) => {
            if (!workspace) return;

            const link = await deps.workspaceSessionService.link(workspace.id, createdSession.id);
            deps.eventBus.emit("workspace_sessions", "set", link);
          },
        });
        await emitActivityEvent(deps, {
          projectId: input.projectId,
          resourceType: "session",
          resourceId: session.id,
          eventType: "session_created",
          summary: `Created session ${session.title}`,
          payload: {
            status: session.status,
            workspace_id: workspace?.id ?? null,
          },
        });
        return { type: "session", id: session.id, title: session.title, status: session.status };
      },
      followup: async (followupInput) => {
        const session = await deps.sessionService.get(followupInput.sessionId);
        if (!session) throw new Error(`Session not found: ${followupInput.sessionId}`);
        if (!session.cwd) throw new Error(`Session has no cwd: ${followupInput.sessionId}`);
        const prompt = await resolveExtensionPrompt(deps, session.project_id ?? input.projectId, followupInput);
        await createSessionScheduler(deps as SessionsRouteDeps).startOrQueueExisting({
          session,
          prompt,
          cwd: session.cwd,
          respectCapacity: true,
        });
      },
    },
    workspaces: {
      list: async () => (await deps.workspaceService.list(input.projectId)) as ExtensionWorkspace[],
      get: async (id) => (await deps.workspaceService.get(id)) as ExtensionWorkspace | null,
      getByShorthand: async (shorthand) =>
        (await deps.workspaceService.getByShorthand(input.projectId, shorthand)) as ExtensionWorkspace | null,
      create: async (workspaceInput) =>
        (await createExtensionWorkspace(
          deps,
          { projectId: input.projectId, workspaceInput },
          runtimeDeps,
        )) as ExtensionWorkspace,
      archive: async (id) => {
        const workspace = await deps.workspaceService.get(id);
        // Cascade archive: also archive the workspace's sessions and remove its worktree.
        if (workspace) await archiveWorkspaceCascade(deps, workspace);
      },
      delete: async (id) => {
        await deps.workspaceService.softDelete(id);
      },
    },
    worktrees: createExtensionWorktreesApi(deps, { projectId: input.projectId }),
    repos: createReposApi(deps, input.projectId),
    activity: {
      record: async (activity) => {
        const target = activity.target ?? { type: "extension", id: enabledSource.instance.id };
        const event = await deps.activityEventsService.create({
          projectId: input.projectId,
          resourceType: target.type,
          resourceId: target.id,
          sourceExtensionId: enabledSource.installedSource.id,
          eventType: "extension.command",
          actorType: "system",
          source: "api",
          summary: activity.message,
          payloadJson: { related: activity.related ?? [], metadata: activity.metadata ?? {} },
        });
        return { id: event.id };
      },
    },
    notify: { toast: async () => {} },
    process: createProcessApi(),
    net: { findFreePort: async (portInput) => findFreePort(portInput?.host) },
    settings,
  };
};
