import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

// Keep the dispatch relationship with its supervisor's history, separate from mutable attempt state.
const supervisorStorage = (ctx: Pick<ExtensionContextBase, "storage">, sessionId: string) =>
  ctx.storage.scope({ type: "auto-build-supervisor", id: sessionId });

export const autoBuildDispatches = (ctx: Pick<ExtensionContextBase, "storage">, sessionId: string) =>
  supervisorStorage(ctx, sessionId).collection<{ workspaceId: string; dispatchedAt: string }>("dispatches");

// A supervisor can receive repair evidence before human input or capacity allows a repair to start.
export const autoBuildPullRequestNotifications = (ctx: Pick<ExtensionContextBase, "storage">, sessionId: string) =>
  supervisorStorage(ctx, sessionId).collection<{ evidenceKey: string }>("pull-request-notifications");
