import type { ExtensionSessionsApi, ResourceRef } from "@pstdio/sdk/extensions";
import type { AgentRegistry } from "pstdio-agents";
import type { createExtensionInstancesDBService, DbClient } from "pstdio-db";
import { loadExtensionRuntime, runExtensionCommand } from "pstdio-extensions";
import { isAgentEnabledForProject, parseProjectSelectedAgents } from "../features/projects/selected-agents";
import { resolveSessionCwd } from "../features/sessions/resolve-session-cwd";
import { spawnAgentSession } from "../features/sessions/spawn-agent";
import type { EventBus } from "../features/sync/event-bus";
import type { createAgentConfigService } from "./agent-config-service";
import type { createFileService } from "./file-service";
import type { createProjectService } from "./project-service";
import type { createRepoService } from "./repo-service";
import type { createSessionService } from "./session-service";
import type { createWorkspaceService } from "./workspace-service";
import type { createWorkspaceSessionService } from "./workspace-session-service";

type ExtensionRuntime = Awaited<ReturnType<typeof loadExtensionRuntime>>;
type ExtensionCommandServiceDeps = {
  agentConfigService: Pick<ReturnType<typeof createAgentConfigService>, "list">;
  agentRegistry: AgentRegistry;
  db: DbClient;
  eventBus: EventBus;
  extensionInstancesDBService: ReturnType<typeof createExtensionInstancesDBService>;
  fileService: ReturnType<typeof createFileService>;
  projectService: Pick<ReturnType<typeof createProjectService>, "get">;
  repoService: ReturnType<typeof createRepoService>;
  sessionService: ReturnType<typeof createSessionService>;
  workspaceService: ReturnType<typeof createWorkspaceService>;
  workspaceSessionService: Pick<ReturnType<typeof createWorkspaceSessionService>, "link">;
};

type ExecuteExtensionCommandInput = {
  projectId: string;
  commandId: string;
  params?: Record<string, unknown>;
  target?: ResourceRef;
};

export class ExtensionCommandNotFoundError extends Error {}

type SessionInput = Parameters<ExtensionSessionsApi["create"]>[0];
type ProjectRecord = Awaited<ReturnType<ExtensionCommandServiceDeps["projectService"]["get"]>>;

const supportedAnchorTypes = new Set(["project", "workspace"]);

const findWorkspaceAnchor = (anchors: ResourceRef[] | undefined) => {
  const workspaceAnchors = anchors?.filter((anchor) => anchor.type === "workspace") ?? [];
  return workspaceAnchors.find((anchor) => anchor.role === "primary") ?? workspaceAnchors[0];
};

const findUnsupportedAnchor = (anchors: ResourceRef[] | undefined) =>
  anchors?.find((anchor) => !supportedAnchorTypes.has(anchor.type));

const filterDisabledExtensions = (runtime: ExtensionRuntime, disabledExtensionIds: Set<string>) => {
  if (disabledExtensionIds.size === 0) return runtime;

  const isEnabled = (extensionId: string) => !disabledExtensionIds.has(extensionId);

  return {
    ...runtime,
    extensions: runtime.extensions.filter((extension) => isEnabled(extension.id)),
    commands: runtime.commands.filter((command) => isEnabled(command.extensionId)),
    cli: runtime.cli.filter((contribution) => isEnabled(contribution.extensionId)),
    artifactMounts: runtime.artifactMounts.filter((mount) => isEnabled(mount.extensionId)),
    templateTypes: runtime.templateTypes.filter((templateType) => isEnabled(templateType.extensionId)),
    templates: runtime.templates.filter((template) => isEnabled(template.extensionId)),
    skills: runtime.skills.filter((skill) => isEnabled(skill.extensionId)),
    harnesses: runtime.harnesses.filter((harness) => isEnabled(harness.extensionId)),
  };
};

const resolveCliPath = (runtime: ExtensionRuntime, commandId: string) =>
  runtime.cli.find((contribution) => contribution.commandId === commandId)?.path ?? commandId;

const formatDisabledCommandMessage = (runtime: ExtensionRuntime, commandId: string, extensionId: string) =>
  `Command "${resolveCliPath(runtime, commandId)}" is unavailable because no enabled extension provides it. ` +
  `It is normally provided by "${extensionId}". Extension "${extensionId}" is disabled for this project.`;

const resolveDefaultAgentId = async (deps: ExtensionCommandServiceDeps, project: ProjectRecord) => {
  const configuredAgents = await deps.agentConfigService.list();
  const selectedAgents = project ? parseProjectSelectedAgents(project) : [];
  const availableConfiguredAgents =
    selectedAgents.length === 0
      ? configuredAgents
      : configuredAgents.filter((config) => selectedAgents.includes(config.agent_id));
  const defaultAgent = availableConfiguredAgents.find((config) => config.is_default) ?? availableConfiguredAgents[0];

  if (defaultAgent && project && !isAgentEnabledForProject(project, defaultAgent.agent_id)) {
    return null;
  }

  return defaultAgent?.agent_id ?? null;
};

const resolveWorkspaceId = async (
  deps: ExtensionCommandServiceDeps,
  projectId: string,
  workspaceAnchor: ResourceRef | undefined,
) => {
  if (!workspaceAnchor) return undefined;

  const workspace =
    (await deps.workspaceService.get(workspaceAnchor.id)) ??
    (await deps.workspaceService.getByShorthand(projectId, workspaceAnchor.id));
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceAnchor.id}`);
  }

  return workspace.id;
};

const createSessionFromExtensionCommand = async (
  deps: ExtensionCommandServiceDeps,
  projectId: string,
  sessionInput: SessionInput,
) => {
  if (!sessionInput.prompt) {
    throw new Error("Extension command API sessions require a prompt.");
  }

  if (sessionInput.metadata !== undefined) {
    throw new Error("Extension command API sessions cannot preserve metadata yet.");
  }

  const unsupportedAnchor = findUnsupportedAnchor(sessionInput.anchors);
  if (unsupportedAnchor) {
    throw new Error(`Extension command API sessions cannot preserve "${unsupportedAnchor.type}" anchors yet.`);
  }

  const project = await deps.projectService.get(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const workspaceId = await resolveWorkspaceId(deps, projectId, findWorkspaceAnchor(sessionInput.anchors));
  const agentId = await resolveDefaultAgentId(deps, project);
  if (!agentId) {
    throw new Error("No agent configured. Set a default agent with 'pstdio agents setup' first.");
  }

  const cwd = await resolveSessionCwd(deps, projectId, workspaceId);
  const session = await deps.sessionService.create({
    project_id: projectId,
    title: sessionInput.title,
    agent: agentId,
    cwd: cwd ?? undefined,
  });

  if (workspaceId) {
    const link = await deps.workspaceSessionService.link(workspaceId, session.id);
    deps.eventBus.emit("workspace_sessions", "set", link);
  }

  spawnAgentSession(
    {
      sessionId: session.id,
      agentId,
      prompt: sessionInput.prompt,
      title: sessionInput.title,
      cwd,
    },
    deps,
  ).catch(async () => {
    await deps.sessionService.transitionStatus(session.id, "failed");
  });

  return session;
};

const createExtensionCommandSessions = (deps: ExtensionCommandServiceDeps, projectId: string) => {
  const sessions = {
    create: (sessionInput) => createSessionFromExtensionCommand(deps, projectId, sessionInput),
  } satisfies ExtensionSessionsApi;

  return sessions;
};

export const createExtensionCommandService = (deps: ExtensionCommandServiceDeps) => {
  const loadProjectRuntime = async (projectId: string) => {
    const [repo] = await deps.repoService.listByProject(projectId);
    if (!repo) {
      throw new ExtensionCommandNotFoundError("Extension command execution requires a linked project repository.");
    }

    return loadExtensionRuntime({ projectRoot: repo.path });
  };

  const listDisabledExtensionIds = async (projectId: string) => {
    const instances = await deps.extensionInstancesDBService.list(projectId);
    return new Set(instances.filter((instance) => !instance.enabled).map((instance) => instance.extension_id));
  };

  const execute = async (input: ExecuteExtensionCommandInput) => {
    const runtime = await loadProjectRuntime(input.projectId);
    const disabledExtensionIds = await listDisabledExtensionIds(input.projectId);
    const disabledCommand = runtime.commands.find(
      (command) => command.id === input.commandId && disabledExtensionIds.has(command.extensionId),
    );

    if (disabledCommand) {
      throw new Error(formatDisabledCommandMessage(runtime, input.commandId, disabledCommand.extensionId));
    }

    const filteredRuntime = filterDisabledExtensions(runtime, disabledExtensionIds);
    const command = filteredRuntime.commands.find((candidate) => candidate.id === input.commandId);
    if (!command) {
      throw new ExtensionCommandNotFoundError(`Extension command "${input.commandId}" was not found.`);
    }

    return runExtensionCommand({
      commands: filteredRuntime.commands,
      db: deps.db,
      projectId: input.projectId,
      commandId: input.commandId,
      params: input.params,
      target: input.target,
      sessions: createExtensionCommandSessions(deps, input.projectId),
    });
  };

  return { execute };
};
