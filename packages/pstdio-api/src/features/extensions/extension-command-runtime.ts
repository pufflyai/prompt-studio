import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import type { ExtensionCommandRecord } from "pstdio-api-contracts";
import type { CommandRunnerEnvironment, RuntimeArtifactMount, RuntimeCommandRecord } from "pstdio-extensions";
import { createArtifactMount, loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";
import type { SessionsRouteDeps } from "../sessions/deps";
import { resolvePrompt } from "../sessions/resolve-prompt";
import { createSessionScheduler } from "../sessions/session-scheduler";
import { setWorkspaceAttemptStatus } from "../workspaces/attempt-status-transition";
import type { ExtensionsRouteDeps } from "./deps";
import { createExtensionWorktreesApi } from "./extension-worktree-environment";

type EnabledSource = Awaited<
  ReturnType<ExtensionsRouteDeps["extensionService"]["listEnabledSourcesForProject"]>
>[number];

export const loadProjectExtensionRuntime = async (deps: ExtensionsRouteDeps, projectId: string) => {
  const enabledSources = await deps.extensionService.listEnabledSourcesForProject(projectId);
  const loaded = await loadExtensionSources({
    extensionPackages: enabledSources.map(({ installedSource }) => ({
      path: installedSource.source_path,
    })),
  });

  const runtime = normalizeExtensionSources(loaded.sources, loaded.diagnostics);
  return { enabledSources, runtime };
};

export const toCommandRecord = (command: RuntimeCommandRecord): ExtensionCommandRecord => ({
  id: command.id,
  extensionId: command.extensionId,
  title: command.title,
  description: command.description,
  cliPath: command.cli?.pathKey,
  examples: command.cli?.examples,
  params: command.params as ExtensionCommandRecord["params"],
});

const findEnabledSource = (enabledSources: EnabledSource[], extensionId: string) =>
  enabledSources.find(({ installedSource }) => installedSource.extension_id === extensionId);

const createStorageApi = (
  deps: ExtensionsRouteDeps,
  input: {
    extensionInstanceId: string;
    projectId: string;
    scopeType?: string;
    scopeId?: string;
  },
): CommandRunnerEnvironment["storage"] => {
  const scope = {
    extension_instance_id: input.extensionInstanceId,
    scope_type: input.scopeType ?? "project",
    scope_id: input.scopeId ?? input.projectId,
  };

  const api: CommandRunnerEnvironment["storage"] = {
    scope(nextScope) {
      if (nextScope.type === "project") return createStorageApi(deps, input);
      if (nextScope.type === "repo") {
        const repoId = "repoId" in nextScope ? nextScope.repoId : undefined;
        return createStorageApi(deps, { ...input, scopeType: "repo", scopeId: repoId ?? input.projectId });
      }
      if (nextScope.type === "resource") {
        const resource = "resource" in nextScope ? nextScope.resource : undefined;
        return createStorageApi(deps, {
          ...input,
          scopeType: "resource",
          scopeId: resource?.id ?? input.projectId,
        });
      }
      const customId = "id" in nextScope ? nextScope.id : undefined;
      return createStorageApi(deps, { ...input, scopeType: nextScope.type, scopeId: customId ?? input.projectId });
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
      };
    },
  };

  return api;
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

export const createCommandEnvironment = (
  deps: ExtensionsRouteDeps,
  enabledSources: EnabledSource[],
  input: { artifactMounts?: RuntimeArtifactMount[]; extensionId: string; name: string; projectId: string },
): CommandRunnerEnvironment => {
  const enabledSource = findEnabledSource(enabledSources, input.extensionId);
  if (!enabledSource) throw new Error(`Enabled extension instance not found: ${input.extensionId}`);

  const storage = createStorageApi(deps, {
    extensionInstanceId: enabledSource.instance.id,
    projectId: input.projectId,
  });

  return {
    storage,
    artifacts: createArtifactsApi(deps, input),
    files: createFilesApi(deps, input.projectId),
    sessions: {
      create: async (sessionInput) => {
        const workspace =
          sessionInput.workspaceId != null
            ? ((await deps.workspaceService.get(sessionInput.workspaceId)) ??
              (await deps.workspaceService.getByShorthand(input.projectId, sessionInput.workspaceId)))
            : null;
        const repoPath = sessionInput.repoId ? (await deps.repoService.get(sessionInput.repoId))?.path : undefined;
        const session = await deps.sessionService.create({
          project_id: input.projectId,
          title: sessionInput.title,
          agent: "extension",
          original_session_id: sessionInput.originalSessionId,
          cwd: repoPath ?? workspace?.worktree_path ?? undefined,
        });
        if (workspace) {
          const link = await deps.workspaceSessionService.link(workspace.id, session.id);
          deps.eventBus.emit("workspace_sessions", "set", link);
        }
        return { id: session.id };
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
      get: (id) => deps.workspaceService.get(id),
      create: async (workspaceInput) => {
        const projectId = typeof workspaceInput.project_id === "string" ? workspaceInput.project_id : input.projectId;
        if (typeof workspaceInput.ticket_id !== "string") throw new Error("Workspace creation requires ticket_id");
        if (typeof workspaceInput.ticket_shorthand !== "string") {
          throw new Error("Workspace creation requires ticket_shorthand");
        }
        return deps.workspaceService.create({
          project_id: projectId,
          ticket_id: workspaceInput.ticket_id,
          ticket_shorthand: workspaceInput.ticket_shorthand,
          branch: typeof workspaceInput.branch === "string" ? workspaceInput.branch : undefined,
          worktree_path: typeof workspaceInput.worktree_path === "string" ? workspaceInput.worktree_path : undefined,
        });
      },
      archive: async (id) => {
        await deps.workspaceService.archive(id);
      },
      delete: async (id) => {
        await deps.workspaceService.softDelete(id);
      },
      setAttemptStatus: async ({ workspaceId, status, sessionId }) => {
        const transition = await setWorkspaceAttemptStatus(deps, { workspaceId, status, sessionId });
        return transition.result;
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
    settings: {
      all: async () => ({}),
      get: (key) => storage.scope({ type: "settings" }).get(String(key)),
      set: (key, value) => storage.scope({ type: "settings" }).set(String(key), value),
      delete: (key) => storage.scope({ type: "settings" }).delete(String(key)),
    },
  };
};
