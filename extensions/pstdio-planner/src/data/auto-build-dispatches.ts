import type { ExtensionContextBase, StoragePredicate, StorageRecordIndex } from "@pstdio/sdk/extensions";
import { preparePlannerIndexes } from "./storage-indexes";

export const autoBuildDispatchIndex: StorageRecordIndex = {
  name: "auto-build-dispatches",
  prefix: '["auto-build-supervisor",',
  fields: {
    supervisorId: { path: ["unused"], type: "string", derive: { kind: "scopeId" } },
    workspaceId: { path: ["value", "workspaceId"], type: "string" },
    dispatchedAt: { path: ["value", "dispatchedAt"], type: "string" },
  },
  equality: ["supervisorId"],
  orderBy: [{ field: "workspaceId", direction: "asc" }],
};

export async function* autoBuildDispatchPages(ctx: Pick<ExtensionContextBase, "storage">, supervisorId: string) {
  await preparePlannerIndexes(ctx.storage);
  let after: string | undefined;
  for (;;) {
    const where: StoragePredicate = {
      all: [
        { field: "supervisorId", op: "eq", value: supervisorId },
        { field: "workspaceId", op: "notEmpty" },
        ...(after ? [{ field: "workspaceId", op: "gt" as const, value: after }] : []),
      ],
    };
    const page = await ctx.storage.records.query({
      index: autoBuildDispatchIndex.name,
      where,
      fields: ["workspaceId", "dispatchedAt"],
      limit: 100,
    });
    if (!page.records.length) return;
    yield page.records.map(({ fields }) => ({
      workspaceId: String(fields.workspaceId),
      dispatchedAt: String(fields.dispatchedAt),
    }));
    after = String(page.records.at(-1)!.fields.workspaceId);
    if (page.records.length < 100) return;
  }
}

// Keep the dispatch relationship with its supervisor's history, separate from mutable attempt state.
const supervisorStorage = (ctx: Pick<ExtensionContextBase, "storage">, sessionId: string) =>
  ctx.storage.scope({ type: "auto-build-supervisor", id: sessionId });

export const autoBuildDispatches = (ctx: Pick<ExtensionContextBase, "storage">, sessionId: string) =>
  supervisorStorage(ctx, sessionId).collection<{ workspaceId: string; dispatchedAt: string }>("dispatches");

// A supervisor can receive repair evidence before review input or capacity allows a repair to start.
export const autoBuildPullRequestNotifications = (ctx: Pick<ExtensionContextBase, "storage">, sessionId: string) =>
  supervisorStorage(ctx, sessionId).collection<{ evidenceKey: string }>("pull-request-notifications");
