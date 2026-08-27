import type { CommandContext, ExtensionStorageApi } from "@pstdio/sdk/extensions";

// Tests only stub the slice of each context member a command reads, so overrides
// allow a partial of every member (e.g. a workspaces API with just `list`).
type CommandContextOverrides = {
  [K in keyof CommandContext]?: Partial<CommandContext[K]>;
};

interface CommandContextInput<TParams extends Record<string, unknown>> {
  storage: ExtensionStorageApi;
  params: TParams;
  projectId?: string;
  overrides?: CommandContextOverrides;
}

const paramsByContext = new WeakMap<object, Record<string, unknown>>();

// Tests build only the context surface a command reads, rather than the full runtime.
// The runtime always provides `workspaces` and `sessions`, so the fixture defaults them to
// empty lists; tests that exercise workspace- or session-linked behavior override them.
export const makeCommandContext = <TParams extends Record<string, unknown>>({
  overrides,
  storage,
  params,
  projectId = "proj-1",
}: CommandContextInput<TParams>) => {
  const context = {
    extensionId: "pstdio-planner",
    storage,
    projectId,
    project: { id: projectId, name: "Test Project", shorthand: "T" },
    invocation: {},
    notify: { action: async () => ({}), dismiss: async () => [], resolve: async () => [], toast: async () => {} },
    events: { emit: async () => ({ delivered: 0 }) },
    workspaces: { list: async () => [] },
    sessions: { list: async () => [], listByWorkspace: async () => [], addAnchors: async () => {} },
    repos: {
      list: async () => [{ projectId, repoId: "repo-1", path: "/repo", role: "default" }],
      get: async () => ({ projectId, repoId: "repo-1", path: "/repo", role: "default" }),
      getDefault: async () => ({ projectId, repoId: "repo-1", path: "/repo", role: "default" }),
    },
    process: {
      run: async () => ({ exitCode: 0, stdout: "main-sha\n", stderr: "" }),
      runOrThrow: async () => ({ exitCode: 0, stdout: "main-sha\n", stderr: "" }),
    },
    packageFiles: {
      readText: async () =>
        "{{ticket}} {{workspaceId}} {{templateName}} {{additionalContext}} {{reviewId}} {{revision}} {{headSha}}",
    },
    settings: { all: async () => ({ "automation.maxInProgress": 2 }) },
    ...overrides,
  } as unknown as CommandContext;
  paramsByContext.set(context, params);
  return context;
};

export const commandParamsFor = <TParams extends Record<string, unknown>>(context: CommandContext) =>
  paramsByContext.get(context) as TParams;

export const makeCommandArgs = <TParams extends Record<string, unknown>>(input: CommandContextInput<TParams>) =>
  [makeCommandContext(input), input.params] as const;
