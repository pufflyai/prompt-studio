import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionCommandRecord } from "pstdio-api-contracts";
import type { CommandRunnerEnvironment, RuntimeCommandRecord } from "pstdio-extensions";
import { loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "./deps";

type EnabledSource = Awaited<
  ReturnType<ExtensionsRouteDeps["extensionService"]["listEnabledSourcesForProject"]>
>[number];

const sourceKindForRuntime = (sourceKind: string) => (sourceKind === "builtin" ? "builtin" : "local");

export const loadProjectExtensionRuntime = async (deps: ExtensionsRouteDeps, projectId: string) => {
  const enabledSources = await deps.extensionService.listEnabledSourcesForProject(projectId);
  const loaded = await loadExtensionSources({
    extensionPackages: enabledSources.map(({ installedSource }) => ({
      path: installedSource.source_path,
      sourceKind: sourceKindForRuntime(installedSource.source_kind),
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

const findEnabledSource = (enabledSources: EnabledSource[], extensionId: string, name: string) =>
  enabledSources.find(
    ({ instance, installedSource }) => instance.namespace === name && installedSource.extension_id === extensionId,
  );

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

const createProcessApi = (): CommandRunnerEnvironment["process"] => ({
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
  async spawnDetached(input) {
    const proc = Bun.spawn(input.command, {
      cwd: input.cwd,
      env: input.env ? { ...process.env, ...input.env } : process.env,
      stderr: "ignore",
      stdout: "ignore",
    });
    return { pid: proc.pid };
  },
});

export const createCommandEnvironment = (
  deps: ExtensionsRouteDeps,
  enabledSources: EnabledSource[],
  input: { extensionId: string; name: string; projectId: string },
): CommandRunnerEnvironment => {
  const enabledSource = findEnabledSource(enabledSources, input.extensionId, input.name);
  if (!enabledSource) throw new Error(`Enabled extension instance not found: ${input.extensionId}`);

  const storage = createStorageApi(deps, {
    extensionInstanceId: enabledSource.instance.id,
    projectId: input.projectId,
  });

  return {
    storage,
    artifacts: {
      mount: () => {
        throw new Error("Extension artifact mounts are not available for this command context yet");
      },
    },
    files: createFilesApi(deps, input.projectId),
    sessions: {
      create: async (sessionInput) => {
        const session = await deps.sessionService.create({
          project_id: input.projectId,
          title: sessionInput.title,
          agent: "extension",
          original_session_id: sessionInput.originalSessionId,
          cwd: sessionInput.repoId ? (await deps.repoService.get(sessionInput.repoId))?.path : undefined,
        });
        return { id: session.id };
      },
      followup: async () => {},
    },
    workspaces: {
      get: (id) => deps.workspaceService.get(id),
      create: async () => {
        throw new Error("Extension workspace creation requires a ticket-backed workspace");
      },
      archive: async (id) => {
        await deps.workspaceService.archive(id);
      },
      delete: async (id) => {
        await deps.workspaceService.softDelete(id);
      },
    },
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
    net: { findFreePort: async () => 0 },
    settings: {
      all: async () => ({}),
      get: (key) => storage.scope({ type: "settings" }).get(String(key)),
      set: (key, value) => storage.scope({ type: "settings" }).set(String(key), value),
      delete: (key) => storage.scope({ type: "settings" }).delete(String(key)),
    },
  };
};
