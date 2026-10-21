import type { CommandContext, ExtensionStorageApi } from "pstdio-api-contracts/extension-kernel";
import { createCommandContextDefaults } from "./command-context-defaults";
import { createMemoryResourceLinks } from "./memory-resource-links";
import { createMemoryResources } from "./memory-resources";

type ContextNamespace =
  | "project"
  | "resources"
  | "views"
  | "navigation"
  | "artifacts"
  | "projectFiles"
  | "packageFiles"
  | "extensionFiles"
  | "files"
  | "skills"
  | "sessions"
  | "workspaces"
  | "commands"
  | "events"
  | "activity"
  | "notify"
  | "automation"
  | "process"
  | "net"
  | "connections"
  | "logger"
  | "settings"
  | "account"
  | "stream"
  | "invocation";
export type CommandContextOverrides = Partial<Omit<CommandContext, ContextNamespace>> & {
  [K in ContextNamespace]?: Partial<CommandContext[K]>;
};
export interface CommandContextInput<TParams extends Record<string, unknown>> {
  storage: ExtensionStorageApi;
  params: TParams;
  projectId?: string;
  resourcePrefixes?: Record<string, string>;
  overrides?: CommandContextOverrides;
}
// Only the counters are shared per storage. Each context resolves prefixes from its own
// input, so a context that overrides the project shorthand allocates with that prefix.
const linksByStorage = new WeakMap<ExtensionStorageApi, Parameters<typeof createMemoryResourceLinks>[0]["edges"]>();
const sequencesByStorage = new WeakMap<ExtensionStorageApi, Map<string, number>>();
const paramsByContext = new WeakMap<object, Record<string, unknown>>();

export const makeCommandContext = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) => {
  const { storage, params, projectId = "proj-1", overrides } = input;
  let sequences = sequencesByStorage.get(storage);
  if (!sequences) {
    sequences = new Map<string, number>();
    sequencesByStorage.set(storage, sequences);
  }
  let edges = linksByStorage.get(storage);
  if (!edges) {
    edges = new Map();
    linksByStorage.set(storage, edges);
  }
  const resources = createMemoryResources(
    input.resourcePrefixes ?? {},
    sequences,
    createMemoryResourceLinks({ projectId, extensionId: overrides?.extensionId ?? "test.extension", edges }),
    { projectId, extensionId: overrides?.extensionId ?? "test.extension" },
  );
  const base = createCommandContextDefaults({ projectId, storage, resources });
  const context: CommandContext = {
    ...base,
    ...overrides,
    project: { ...base.project, ...overrides?.project },
    // Storage is the caller's stateful object, not a namespace of defaults. Copying it would hide
    // later fault injection and break identity-keyed caches, so an override replaces it whole.
    storage: overrides?.storage ?? base.storage,
    resources: { ...base.resources, ...overrides?.resources },
    views: { ...base.views, ...overrides?.views },
    navigation: { ...base.navigation, ...overrides?.navigation },
    artifacts: { ...base.artifacts, ...overrides?.artifacts },
    projectFiles: { ...base.projectFiles, ...overrides?.projectFiles },
    packageFiles: { ...base.packageFiles, ...overrides?.packageFiles },
    extensionFiles: { ...base.extensionFiles, ...overrides?.extensionFiles },
    files: { ...base.files, ...overrides?.files },
    skills: { ...base.skills, ...overrides?.skills },
    sessions: { ...base.sessions, ...overrides?.sessions },
    workspaces: { ...base.workspaces, ...overrides?.workspaces },
    commands: { ...base.commands, ...overrides?.commands },
    events: { ...base.events, ...overrides?.events },
    activity: { ...base.activity, ...overrides?.activity },
    notify: { ...base.notify, ...overrides?.notify },
    automation: { ...base.automation, ...overrides?.automation },
    process: { ...base.process, ...overrides?.process },
    net: { ...base.net, ...overrides?.net },
    connections: { ...base.connections, ...overrides?.connections },
    logger: { ...base.logger, ...overrides?.logger },
    settings: { ...base.settings, ...overrides?.settings },
    account: { ...base.account, ...overrides?.account },
    stream: { ...base.stream, ...overrides?.stream },
    invocation: { ...base.invocation, ...overrides?.invocation },
  };
  paramsByContext.set(context, params);
  return context;
};
export const commandParamsFor = <TParams extends Record<string, unknown>>(context: CommandContext) =>
  paramsByContext.get(context) as TParams;
export const makeCommandArgs = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) =>
  [makeCommandContext(input), input.params] as const;
