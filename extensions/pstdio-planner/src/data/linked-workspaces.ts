import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { plannerOwnerFor } from "./ticket-resource-hierarchy";

type Context = Pick<ExtensionContextBase, "resources" | "workspaces"> & { extensionId?: string; projectId?: string };
/** Query the workspace provider so personal remote history remains part of the same bounded page. */
export const linkedWorkspacePage = async (ctx: Context, tickets: { id: string }[], cursor?: string) => {
  const page = await ctx.workspaces.query({
    anchors: tickets.map(({ id }) => ({
      type: "ticket",
      id,
      extensionId: plannerOwnerFor(ctx),
      projectId: ctx.projectId,
    })),
    limit: 100,
    cursor,
  });
  return { items: page.items, nextCursor: page.nextCursor ?? undefined };
};

export async function* linkedWorkspacePages(ctx: Context, tickets: { id: string }[]) {
  for (let offset = 0; offset < tickets.length; offset += 100) {
    let cursor: string | undefined;
    do {
      const page = await linkedWorkspacePage(ctx, tickets.slice(offset, offset + 100), cursor);
      yield page.items;
      cursor = page.nextCursor;
    } while (cursor);
  }
}

export async function* workspaceTicketLinks(ctx: Context, workspaceId: string) {
  const workspace = await ctx.workspaces.get(workspaceId);
  // Personal history owns remote links; they need not exist in this device's shared index.
  if (workspace?.device) for (const ref of workspace.anchors_json ?? []) if (ref.type === "ticket") yield ref;
  let cursor: string | undefined;
  do {
    const page = await ctx.resources.queryAnchors({
      resource: { type: "workspace", id: workspaceId, extensionId: "pstdio", projectId: ctx.projectId },
      direction: "both",
      limit: 100,
      cursor,
    });
    for (const { source, target } of page.items) {
      const other = source.type === "workspace" && source.id === workspaceId ? target : source;
      if (other.type === "ticket") yield other;
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
}
