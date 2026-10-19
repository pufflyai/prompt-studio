import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

// Keep the dispatch relationship with its supervisor's history, separate from mutable attempt state.
export const autoBuildDispatches = (ctx: Pick<ExtensionContextBase, "storage">, sessionId: string) =>
  ctx.storage
    .scope({ type: "auto-build-supervisor", id: sessionId })
    .collection<{ workspaceId: string; dispatchedAt: string }>("dispatches");
