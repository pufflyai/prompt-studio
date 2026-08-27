import type { CommandContext, ExtensionStorageApi } from "@pstdio/sdk/extensions";

type CommandContextOverrides<TParams extends Record<string, unknown>> = {
  [K in keyof CommandContext<TParams>]?: Partial<CommandContext<TParams>[K]>;
};

interface CommandContextInput<TParams extends Record<string, unknown>> {
  storage: ExtensionStorageApi;
  params: TParams;
  projectId?: string;
  overrides?: CommandContextOverrides<TParams>;
}

export const makeCommandContext = <TParams extends Record<string, unknown>>({
  overrides,
  storage,
  params,
  projectId = "proj-1",
}: CommandContextInput<TParams>) =>
  ({
    extensionId: "pstdio-reports",
    name: "pstdio-reports",
    storage,
    projectId,
    project: { id: projectId, name: "Test Project", shorthand: "T" },
    invocation: { params },
    events: { emit: async () => ({ delivered: 0 }) },
    packageFiles: { readText: async () => "## Confidence Score\n" },
    notify: { action: async () => ({}), dismiss: async () => [], resolve: async () => [], toast: async () => {} },
    workspaces: { list: async () => [], get: async () => null, getByShorthand: async () => null },
    sessions: { list: async () => [] },
    ...overrides,
  }) as unknown as CommandContext<TParams>;

export const makeCommandArgs = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) =>
  [makeCommandContext(input), input.params] as const;
