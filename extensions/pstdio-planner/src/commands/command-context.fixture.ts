import type { CommandContext, ExtensionStorageApi } from "@pstdio/sdk/extensions";

// Tests only stub the slice of each context member a command reads, so overrides
// allow a partial of every member (e.g. a workspaces API with just `list`).
type CommandContextOverrides<TParams extends Record<string, unknown>> = {
  [K in keyof CommandContext<TParams>]?: Partial<CommandContext<TParams>[K]>;
};

interface CommandContextInput<TParams extends Record<string, unknown>> {
  storage: ExtensionStorageApi;
  params: TParams;
  projectId?: string;
  overrides?: CommandContextOverrides<TParams>;
}

// Tests build only the context surface a command reads, rather than the full runtime.
// The runtime always provides `workspaces`, so the fixture defaults it to an empty
// list; tests that exercise workspace-linked behavior override it.
export const makeCommandContext = <TParams extends Record<string, unknown>>({
  overrides,
  storage,
  params,
  projectId = "proj-1",
}: CommandContextInput<TParams>) =>
  ({
    extensionId: "pstdio-planner",
    storage,
    projectId,
    project: { id: projectId, name: "Test Project", shorthand: "T" },
    params,
    workspaces: { list: async () => [] },
    ...overrides,
  }) as unknown as CommandContext<TParams>;
