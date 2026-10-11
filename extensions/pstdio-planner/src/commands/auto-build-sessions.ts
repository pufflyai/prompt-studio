import type { CommandContext } from "@pstdio/sdk/extensions";

type Session = Awaited<ReturnType<CommandContext["sessions"]["list"]>>[number];
export const isLiveSession = (session: { status?: string } | null) =>
  session !== null && ["queued", "in_progress", "awaiting_input"].includes(session.status ?? "");

export async function readAutoBuildAssignments(ctx: CommandContext) {
  const [workspaces, all] = await Promise.all([ctx.workspaces.list(), ctx.sessions.list()]);
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
  record(all, []);
  await Promise.all(
    workspaces.map(async (workspace) => {
      const ids = (workspace.anchors_json ?? [])
        .filter((anchor) => anchor.type === "ticket")
        .map((anchor) => anchor.id);
      if (ids.length) record(await ctx.sessions.listByWorkspace(workspace.id), ids);
    }),
  );
  return { assigned, sessions: [...ticketSessions.values()] };
}
