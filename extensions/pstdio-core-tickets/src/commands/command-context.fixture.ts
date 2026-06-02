import type { CommandContext, ExtensionStorageApi } from "@pstdio/sdk/extensions";

interface CommandContextInput<TParams extends Record<string, unknown>> {
  storage: ExtensionStorageApi;
  params: TParams;
  projectId?: string;
}

// Command run handlers in this extension only read storage / projectId / params,
// so tests build a minimal context rather than the full runtime surface.
export const makeCommandContext = <TParams extends Record<string, unknown>>({
  storage,
  params,
  projectId = "proj-1",
}: CommandContextInput<TParams>) => ({ storage, projectId, params }) as unknown as CommandContext<TParams>;
