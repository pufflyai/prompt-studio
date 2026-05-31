import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import type { ExtensionCommandRecord, ExtensionSettingDefinitionRecord } from "pstdio-api-contracts";
import type {
  CommandRunnerEnvironment,
  RuntimeArtifactMount,
  RuntimeCommandRecord,
  RuntimeExtensionSettingRecord,
} from "pstdio-extensions";
import { createArtifactMount, loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";
import { emitActivityEvent } from "../activity/activity-events";
import type { SessionsRouteDeps } from "../sessions/deps";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "../sessions/endpoints/resolve-create-session";
import { resolvePrompt } from "../sessions/resolve-prompt";
import { createSessionScheduler } from "../sessions/session-scheduler";
import type { TicketsRouteDeps } from "../tickets/deps";
import { emitSyncedFile, emitSyncedTicketFile } from "../tickets/emit-ticket-file-sync";
import {
  buildCreateTicketAttemptResponse,
  continueTicketAttemptSetup,
  createAttemptWorkspace,
  resolveSessionCwd as resolveAttemptSessionCwd,
  resolveCreateTicketAttemptContext,
  resolveOptionalAttemptSession,
  startOptionalAttemptSession,
} from "../tickets/endpoints/create-ticket-attempt.utils";
import { extractTitleFromContent } from "../tickets/extract-title";
import { setWorkspaceAttemptStatus } from "../workspaces/attempt-status-transition";
import type { ExtensionsRouteDeps } from "./deps";
import { createAttemptStatusesApi, createTicketStatusesApi } from "./extension-command-status-api";
import { createExtensionWorktreesApi } from "./extension-worktree-environment";

type EnabledSource = Awaited<
  ReturnType<ExtensionsRouteDeps["extensionService"]["listEnabledSourcesForProject"]>
>[number];

export const loadProjectExtensionRuntime = async (deps: ExtensionsRouteDeps, projectId: string) => {
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
  return { enabledSources, runtime };
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

const resolveTicket = async (deps: ExtensionsRouteDeps, projectId: string, ref: string) => {
  const byId = await deps.ticketService.get(ref);
  if (byId) return byId;
  return deps.ticketService.getByShorthand(projectId, ref);
};

const upsertTicketContentFile = async (input: {
  content: string;
  currentFileId: string | null;
  deps: ExtensionsRouteDeps;
  projectId: string;
  ticketId: string;
}) => {
  const ticketDeps = input.deps as unknown as TicketsRouteDeps;
  const data = Buffer.from(input.content, "utf8");

  if (input.currentFileId) {
    const updated = await input.deps.fileService.update(input.currentFileId, { data });
    if (updated) {
      emitSyncedFile(ticketDeps, updated);
      return input.currentFileId;
    }
  }

  const uploaded = await input.deps.fileService.upload({
    project_id: input.projectId,
    file_name: "ticket.md",
    file_kind: "ticket_file",
    data,
    mime_type: "text/markdown",
  });
  const ticketFile = await input.deps.fileService.attachToTicket(input.ticketId, uploaded.id);
  emitSyncedFile(ticketDeps, uploaded);
  emitSyncedTicketFile(ticketDeps, ticketFile);
  return uploaded.id;
};

/** @deprecated Legacy core ticket extension context API. Ticket data is owned by the pstdio tickets extension. */
const createTicketsApi = (deps: ExtensionsRouteDeps, projectId: string): CommandRunnerEnvironment["tickets"] => ({
  async list(input = {}) {
    const status = input.status ? await deps.statusService.getByName(projectId, input.status) : null;
    const filters = {
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
      ...(input.draft !== undefined ? { draft: input.draft } : {}),
      ...(input.parentId ? { parent_id: input.parentId } : {}),
      ...(input.shorthand ? { shorthand: input.shorthand } : {}),
      ...(input.search ? { search: input.search } : {}),
      ...(status ? { status_id: status.id } : {}),
    };
    const tickets = await deps.ticketService.list(projectId, filters);
    const statuses = tickets.some((ticket) => ticket.status_id) ? await deps.statusService.list(projectId) : [];
    const statusNameById = new Map(statuses.map((ticketStatus) => [ticketStatus.id, ticketStatus.name]));

    return Promise.all(
      tickets.map(async (ticket) => {
        const tags = await deps.ticketService.getTagOptionAssignments(ticket.id);
        return {
          ...ticket,
          status_name: ticket.status_id ? (statusNameById.get(ticket.status_id) ?? null) : null,
          tag_ids: tags.map((tag) => tag.id),
          tag_names: tags.map((tag) => tag.name),
        };
      }),
    );
  },
  async get(ref) {
    const ticket = await resolveTicket(deps, projectId, ref);
    if (!ticket) throw new Error(`Ticket not found: ${ref}`);
    return ticket;
  },
  async update(input) {
    const ticket = await resolveTicket(deps, projectId, input.ticket);
    if (!ticket) throw new Error(`Ticket not found: ${input.ticket}`);

    const update: { display_title?: string; file_id?: string } = {};
    if (input.content !== undefined) {
      update.display_title = extractTitleFromContent(input.content);
      update.file_id = await upsertTicketContentFile({
        content: input.content,
        currentFileId: ticket.file_id,
        deps,
        projectId: ticket.project_id,
        ticketId: ticket.id,
      });
    }

    const updated = await deps.ticketService.update(ticket.id, update);
    if (!updated) throw new Error(`Ticket not found: ${input.ticket}`);
    return updated;
  },
  async listFiles(ref) {
    const ticket = await resolveTicket(deps, projectId, ref);
    if (!ticket) throw new Error(`Ticket not found: ${ref}`);
    const files = await deps.fileService.listForTicket(ticket.id);
    return files.map((file) => ({
      ...file,
      fileName: file.file_name,
      fileKind: file.file_kind,
      mimeType: file.mime_type,
    }));
  },
  async createAttempt(input) {
    const ticket = await resolveTicket(deps, projectId, input.ticket);
    if (!ticket) throw new Error(`Ticket not found: ${input.ticket}`);

    const request = {
      agent: input.agent,
      base: input.base,
      branch: input.branch,
      mode: input.mode,
      model: input.model,
      prompt: input.prompt,
      repo_id: input.repoId,
      repo_path: input.repoPath,
      start_session: input.startSession,
    };
    const worktreeMode = "worktree" as const;
    const ticketDeps = deps as unknown as TicketsRouteDeps;
    const context = await resolveCreateTicketAttemptContext(ticketDeps, ticket.id, request, worktreeMode);

    if ("error" in context) {
      throw new Error(context.error.message);
    }

    const pendingSession = await resolveOptionalAttemptSession(ticketDeps, { ticket: context.ticket, request });

    if ("error" in pendingSession) {
      throw new Error(pendingSession.error.message);
    }

    const workspaceWithGitMetadata = await createAttemptWorkspace(ticketDeps, {
      projectId: context.ticket.project_id,
      ticketId: context.ticket.id,
      ticketShorthand: context.ticket.shorthand,
      mode: context.mode,
      worktreeMode,
      repoPath: context.repo.path,
      base: context.base,
    });

    const cwd = resolveAttemptSessionCwd({
      mode: context.mode,
      worktreeMode,
      repoPath: context.repo.path,
      worktreePath: workspaceWithGitMetadata.worktree_path,
    });

    const sessionStart = await startOptionalAttemptSession(ticketDeps, {
      ticket: context.ticket,
      workspace: workspaceWithGitMetadata,
      cwd,
      pending: pendingSession.pending,
      request,
    });

    if ("error" in sessionStart) {
      throw new Error(sessionStart.error.message);
    }

    continueTicketAttemptSetup(ticketDeps, {
      workspace: workspaceWithGitMetadata,
      ticket: context.ticket,
      ticketShorthand: context.ticket.shorthand,
      repo: context.repo,
      mode: context.mode,
      worktreeMode,
      pending: sessionStart.pending,
      started: sessionStart.started,
    });

    await emitActivityEvent(ticketDeps, {
      projectId: context.ticket.project_id,
      resourceType: "ticket",
      resourceId: context.ticket.id,
      eventType: "ticket_attempt_created",
      summary: `Created attempt for ${context.ticket.shorthand}`,
      payload: {
        mode: context.mode,
        workspace_id: workspaceWithGitMetadata.id,
        session_id: sessionStart.started?.session.id ?? null,
      },
    });

    return buildCreateTicketAttemptResponse({
      mode: context.mode,
      ticket: context.ticket,
      workspace: workspaceWithGitMetadata,
      started: sessionStart.started,
    });
  },
  async setStatus(input) {
    const ticket = await resolveTicket(deps, projectId, input.ticket);
    if (!ticket) throw new Error(`Ticket not found: ${input.ticket}`);

    const status = await deps.statusService.getByName(projectId, input.status);
    if (!status) throw new Error(`Ticket status not found: ${input.status}`);

    await deps.ticketService.update(ticket.id, { status_id: status.id });
  },
  async updateWhenAllAttemptsMatch(input) {
    const ticket = await resolveTicket(deps, projectId, input.ticket);
    if (!ticket) throw new Error(`Ticket not found: ${input.ticket}`);

    const workspaces = await deps.workspaceService.listByTicketId(ticket.id);
    if (workspaces.length === 0) return { updated: false };

    const attemptStatus = await deps.attemptStatusService.getByName(projectId, input.allAttemptsStatus);
    if (!attemptStatus) return { updated: false };
    if (!workspaces.every((workspace) => workspace.attempt_status_id === attemptStatus.id)) return { updated: false };

    const ticketStatus = await deps.statusService.getByName(projectId, input.setStatus);
    if (!ticketStatus || ticket.status_id === ticketStatus.id) return { updated: false };

    await deps.ticketService.update(ticket.id, { status_id: ticketStatus.id });
    return { updated: true };
  },
});

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

const resolveHarnessInput = (harness: unknown) => {
  if (!harness || typeof harness !== "object") return {};
  const input = harness as { harnessId?: unknown; model?: unknown };
  return {
    agent: typeof input.harnessId === "string" ? input.harnessId : undefined,
    model: typeof input.model === "string" ? input.model : undefined,
  };
};

export const createCommandEnvironment = (
  deps: ExtensionsRouteDeps,
  enabledSources: EnabledSource[],
  input: {
    artifactMounts?: RuntimeArtifactMount[];
    extensionId: string;
    name: string;
    projectId: string;
    settings?: RuntimeExtensionSettingRecord[];
  },
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
    storage,
    artifacts: createArtifactsApi(deps, input),
    files: createFilesApi(deps, input.projectId),
    tickets: createTicketsApi(deps, input.projectId),
    ticketStatuses: createTicketStatusesApi(deps, input.projectId),
    attemptStatuses: createAttemptStatusesApi(deps, input.projectId),
    sessions: {
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
        const configuredAgents = await deps.agentConfigService.list();
        const resolvedAgent = resolveCreateSessionAgent(harness.agent, project, configuredAgents, deps.agentRegistry);

        if (resolvedAgent.type === "error") {
          throw new Error(resolvedAgent.error);
        }

        if (!resolvedAgent.agentId) {
          throw new Error("No agent configured. Set a default agent with 'pstdio agents setup' first.");
        }

        const model = resolveCreateSessionModel(harness.model, project, resolvedAgent.agentId, deps.agentRegistry, {
          requestAgentWasOmitted: !harness.agent,
        });
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
      getByShorthand: (shorthand) => deps.workspaceService.getByShorthand(input.projectId, shorthand),
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
    settings,
  };
};
