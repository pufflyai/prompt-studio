import type { CommandContext, ExtensionStorageApi } from "@pstdio/sdk/extensions";

interface CommandContextInput<TParams extends Record<string, unknown>> {
  storage: ExtensionStorageApi;
  params: TParams;
  projectId?: string;
  overrides?: Partial<CommandContext<TParams>>;
}

// Tests build only the context surface a command reads, rather than the full runtime.
export const makeCommandContext = <TParams extends Record<string, unknown>>({
  overrides,
  storage,
  params,
  projectId = "proj-1",
}: CommandContextInput<TParams>) =>
  ({ storage, projectId, params, ...overrides }) as unknown as CommandContext<TParams>;
