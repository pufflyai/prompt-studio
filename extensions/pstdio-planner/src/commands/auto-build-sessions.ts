import type { CommandContext, ExtensionSessionSummary } from "@pstdio/sdk/extensions";

type Session = ExtensionSessionSummary;
export const isLiveSession = (session: { status?: string } | null) =>
  session !== null && ["queued", "in_progress", "awaiting_input"].includes(session.status ?? "");

export async function readAutoBuildAssignments(ctx: CommandContext, ticketIds?: string[]) {
  const assigned = new Set<string>();
  const ticketSessions = new Map<string, Session>();
  const record = (sessions: Session[], ticketIds: string[]) => {
    for (const session of sessions.filter(isLiveSession)) {
      const ids = [
        ...ticketIds,
        ...(session.anchors_json ?? []).filter((anchor) => anchor.type === "ticket").map((anchor) => anchor.id),
      ];
      if (ids.length) ticketSessions.set(session.id, session);
      for (const id of ids) assigned.add(id);
    }
  };
  if (ticketIds) {
    for (let offset = 0; offset < ticketIds.length; offset += 8)
      await Promise.all(
        ticketIds.slice(offset, offset + 8).map(async (id) => {
          const page = await ctx.sessions.query({
            anchor: { type: "ticket", id, extensionId: ctx.extensionId, projectId: ctx.projectId },
            includeWorkspaceAnchors: true,
            status: ["queued", "in_progress", "awaiting_input"],
            includeArchived: true,
            limit: 1,
          });
          record(page.items, [id]);
        }),
      );
  } else {
    let cursor: string | undefined;
    do {
      ctx.signal.throwIfAborted();
      const page = await ctx.sessions.query({
        status: ["queued", "in_progress", "awaiting_input"],
        includeArchived: true,
        limit: 100,
        cursor,
      });
      for (const session of page.items) {
        const workspace = session.workspaceId ? await ctx.workspaces.get(session.workspaceId) : undefined;
        const ids = (workspace?.anchors_json ?? []).filter(({ type }) => type === "ticket").map(({ id }) => id);
        record([session], ids);
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }
  return { assigned, sessions: [...ticketSessions.values()] };
}

export const isSupervisorStalled = (active: boolean, progressAt: number) =>
  active && Date.now() - progressAt >= 60 * 60 * 1000;
