import type {
  ArtifactMount,
  CommandInvocation,
  CommandOutcome,
  CommandSource,
  EventDeliveryResult,
  ExtensionActivityApi,
  ExtensionArtifactApi,
  ExtensionFilesApi,
  ExtensionLoggerApi,
  ExtensionNetApi,
  ExtensionNotifyApi,
  ExtensionProcessApi,
  ExtensionProjectContext,
  ExtensionReposApi,
  ExtensionSessionsApi,
  ExtensionSettingsApi,
  ExtensionSkillsApi,
  ExtensionStorageApi,
  ExtensionTemplatesApi,
  ExtensionWorkspacesApi,
  JsonObject,
  RepoContext,
  ResourceRef,
  SlotInvocationContext,
  WorkbenchAttachmentInvocationContext,
  WorkspaceFilesMount,
} from "@pstdio/sdk/extensions";

export const DEFAULT_MAX_COMMAND_DEPTH = 10;

export interface CommandRunnerEnvironment {
  project: ExtensionProjectContext;
  /** Host workspace id when the environment is built for a worktree-backed workspace. */
  workspaceId?: string;
  storage: ExtensionStorageApi;
  artifacts: ExtensionArtifactApi;
  repoFiles?: ArtifactMount;
  workspaceFiles?: WorkspaceFilesMount;
  files: ExtensionFilesApi;
  skills?: ExtensionSkillsApi;
  templates: ExtensionTemplatesApi;
  sessions: ExtensionSessionsApi;
  workspaces: ExtensionWorkspacesApi;
  repos: ExtensionReposApi;
  activity: ExtensionActivityApi;
  notify: ExtensionNotifyApi;
  process: ExtensionProcessApi;
  net: ExtensionNetApi;
  settings: ExtensionSettingsApi;
}

export interface BuildEnvironmentInput {
  projectId: string;
  extensionId: string;
  /** Package name of the owning extension. */
  name: string;
  /** Repo context of the invocation, when run against a project repo (CLI). */
  repo?: RepoContext;
  /** Resolved working directory of the workspace, threaded by workspace lifecycle events. */
  workspaceDir?: string;
  /** Host workspace id of the invocation, when run from inside a worktree-backed workspace. */
  workspaceId?: string;
}

export interface CommandRunnerHostDeps {
  buildEnvironment: (input: BuildEnvironmentInput) => Promise<CommandRunnerEnvironment> | CommandRunnerEnvironment;
  /** Optional logger forwarded to extension contexts. */
  logger?: ExtensionLoggerApi;
  /** Maximum nested command depth. Defaults to 10. */
  maxDepth?: number;
  /** Generates invocation/delivery ids. Defaults to crypto.randomUUID(). */
  generateId?: () => string;
}

export interface CommandExecuteInput {
  commandId: string;
  projectId: string;
  params?: JsonObject;
  resource?: ResourceRef;
  attachment?: WorkbenchAttachmentInvocationContext;
  slot?: SlotInvocationContext;
  repo?: RepoContext;
  /** Resolved working directory of the workspace the command runs from. */
  workspaceDir?: string;
  /** Host workspace id the command runs from. */
  workspaceId?: string;
  source?: CommandSource;
  metadata?: JsonObject;
}

export interface HostCommandExecuteInput<TResult = unknown> extends CommandExecuteInput {
  run(invocation: CommandInvocation): Promise<TResult> | TResult;
}

export interface CommandRunner {
  execute(input: CommandExecuteInput): Promise<CommandOutcome>;
  executeHostCommand<TResult = unknown>(input: HostCommandExecuteInput<TResult>): Promise<CommandOutcome<TResult>>;
  dispatchEvent(input: ExtensionEventDispatchInput): Promise<EventDeliveryResult>;
}

export interface InternalExecuteInput extends CommandExecuteInput {
  depth: number;
}

export interface ExtensionEventDispatchInput {
  eventId: string;
  projectId: string;
  payload?: JsonObject;
}
