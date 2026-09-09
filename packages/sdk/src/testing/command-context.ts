import type { CommandContext, ExtensionStorageApi } from "pstdio-api-contracts/extension-kernel";
import { createMemoryResources } from "./memory-resources";

export type CommandContextOverrides = { [K in keyof CommandContext]?: Partial<CommandContext[K]> };
export interface CommandContextInput<TParams extends Record<string, unknown>> {
  storage: ExtensionStorageApi;
  params: TParams;
  projectId?: string;
  resourcePrefixes?: Record<string, string>;
  overrides?: CommandContextOverrides;
}
// Only the counters are shared per storage. Each context resolves prefixes from its own
// input, so a context that overrides the project shorthand allocates with that prefix.
const sequencesByStorage = new WeakMap<ExtensionStorageApi, Map<string, number>>();
const paramsByContext = new WeakMap<object, Record<string, unknown>>();

export const makeCommandContext = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) => {
  const { storage, params, projectId = "proj-1", overrides } = input;
  let sequences = sequencesByStorage.get(storage);
  if (!sequences) {
    sequences = new Map<string, number>();
    sequencesByStorage.set(storage, sequences);
  }
  const resources = createMemoryResources(input.resourcePrefixes ?? {}, sequences);
  const context = {
    extensionId: "test.extension",
    name: "test-extension",
    projectId,
    project: { id: projectId, name: "Test Project", shorthand: "T" },
    storage,
    resources,
    invocation: { params },
    events: { emit: async () => ({ delivered: 0 }) },
    notify: { action: async () => ({}), dismiss: async () => [], resolve: async () => [], toast: async () => {} },
    workspaces: { list: async () => [], get: async () => null, getByShorthand: async () => null },
    sessions: { list: async () => [], listByWorkspace: async () => [], addAnchors: async () => {} },
    ...overrides,
  } as unknown as CommandContext;
  paramsByContext.set(context, params);
  return context;
};
export const commandParamsFor = <TParams extends Record<string, unknown>>(context: CommandContext) =>
  paramsByContext.get(context) as TParams;
export const makeCommandArgs = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) =>
  [makeCommandContext(input), input.params] as const;
