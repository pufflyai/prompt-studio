import type {
  CommandInvocation,
  CommandOutcome,
  CommandSource,
  EventDeliveryResult,
  ExtensionActivityApi,
  ExtensionArtifactApi,
  ExtensionAttemptStatusesApi,
  ExtensionFilesApi,
  ExtensionLoggerApi,
  ExtensionNetApi,
  ExtensionNotifyApi,
  ExtensionProcessApi,
  ExtensionReposApi,
  ExtensionSessionsApi,
  ExtensionSettingsApi,
  ExtensionStorageApi,
  ExtensionTicketStatusesApi,
  ExtensionTicketsApi,
  ExtensionWorkspacesApi,
  ExtensionWorktreesApi,
  JsonObject,
  RepoContext,
  ResourceRef,
  SlotInvocationContext,
  WorkbenchAttachmentInvocationContext,
} from "@pstdio/sdk/extensions";

export const DEFAULT_MAX_COMMAND_DEPTH = 10;

export interface CommandRunnerEnvironment {
  storage: ExtensionStorageApi;
  artifacts: ExtensionArtifactApi;
  files: ExtensionFilesApi;
  tickets?: ExtensionTicketsApi;
  ticketStatuses?: ExtensionTicketStatusesApi;
  attemptStatuses?: ExtensionAttemptStatusesApi;
  sessions: ExtensionSessionsApi;
  workspaces: ExtensionWorkspacesApi;
  worktrees: ExtensionWorktreesApi;
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
