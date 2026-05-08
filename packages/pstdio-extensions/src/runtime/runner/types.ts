import type {
  CommandOutcome,
  CommandSource,
  ExtensionActivityApi,
  ExtensionArtifactApi,
  ExtensionFilesApi,
  ExtensionLoggerApi,
  ExtensionNetApi,
  ExtensionNotifyApi,
  ExtensionProcessApi,
  ExtensionReposApi,
  ExtensionSessionsApi,
  ExtensionSettingsApi,
  ExtensionStorageApi,
  ExtensionWorkspacesApi,
  JsonObject,
  RepoContext,
  ResourceRef,
  SlotInvocationContext,
} from "@pstdio/sdk/extensions";

export const DEFAULT_MAX_COMMAND_DEPTH = 10;

export interface CommandRunnerEnvironment {
  storage: ExtensionStorageApi;
  artifacts: ExtensionArtifactApi;
  files: ExtensionFilesApi;
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
  namespace: string;
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
  slot?: SlotInvocationContext;
  repo?: RepoContext;
  source?: CommandSource;
  metadata?: JsonObject;
}

export interface CommandRunner {
  execute(input: CommandExecuteInput): Promise<CommandOutcome>;
}

export interface InternalExecuteInput extends CommandExecuteInput {
  depth: number;
}
