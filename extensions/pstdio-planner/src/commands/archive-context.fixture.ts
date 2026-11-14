import type { ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { linkedWorkspacePages } from "../data/linked-workspaces";
import { readSessionHistory } from "../data/session-history";
import { type makeCommandArgs, makeCommandContext } from "./command-context.fixture";
import { cleanupTicketWorkspacesCommand } from "./ticket-workspace-cleanup";

/** Seed the host's resource-link index, separately from workspace presentation records. */
export const seedWorkspaceLinks = async (
  ctx: ReturnType<typeof makeCommandContext>,
  workspaces: ExtensionWorkspace[],
) => {
  const get = ctx.workspaces.get;
  ctx.workspaces.get = async (id) => workspaces.find((row) => row.id === id) ?? get(id);
  ctx.workspaces.query = async (input = {}) => {
    const related = input.anchors === undefined ? null : new Set<string>();
    if (related) {
      let cursor: string | undefined;
      do {
        const page = await ctx.resources.queryRelated({
          resources: input.anchors!,
          direction: "both",
          kind: "workspace",
          owner: "pstdio",
          limit: 100,
          cursor,
        });
        for (const item of page.items) related.add(item.id);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
    }
    const selected = workspaces
      .filter((row) => !related || related.has(row.id))
      .sort((a, b) => a.id.localeCompare(b.id));
    const start = Number(input.cursor ?? 0),
      limit = input.limit ?? 100;
    return {
      items: selected.slice(start, start + limit),
      nextCursor: selected.length > start + limit ? String(start + limit) : null,
    };
  };
  for (const workspace of workspaces)
    await ctx.resources.addAnchors(
      { type: "workspace", id: workspace.id, extensionId: "pstdio" },
      (workspace.anchors_json ?? []).map((ref) => ({
        ...ref,
        extensionId: ref.extensionId ?? "pstdio.pstdio-planner",
      })),
    );
};

export const queuedRun = () => ({
  id: "job",
  projectId: "proj-1",
  commandId: cleanupTicketWorkspacesCommand.id,
  status: "queued" as const,
  createdAt: "2026-11-14",
  startedAt: null,
  finishedAt: null,
  result: null,
  error: null,
});

export const prepareArchiveContext = async (ctx: ReturnType<typeof makeCommandContext>) => {
  await seedWorkspaceLinks(ctx, await ctx.workspaces.list());
  ctx.automation.enqueue = async ({ input }) => {
    void cleanupTicketWorkspacesCommand.run(ctx, { ticketIds: input.params?.ticketIds as string[] });
    return queuedRun();
  };
  return ctx;
};

export const archiveArgs = async <T extends Record<string, unknown>>(input: Parameters<typeof makeCommandArgs<T>>[0]) =>
  [await prepareArchiveContext(makeCommandContext(input)), input.params] as const;

export const workspaceArgs = async <T extends Record<string, unknown>>(
  input: Parameters<typeof makeCommandArgs<T>>[0],
) => {
  const ctx = makeCommandContext(input);
  await seedWorkspaceLinks(ctx, await ctx.workspaces.list());
  const query = ctx.sessions.query;
  ctx.sessions.query = async (input) => {
    if (!input?.anchor || !input.includeWorkspaceAnchors) return query(input);
    const { cursor: _cursor, limit: _limit, ...selection } = input;
    const selected = await readSessionHistory({ query }, { ...selection, includeWorkspaceAnchors: undefined });
    for await (const page of linkedWorkspacePages(ctx, [{ id: input.anchor.id }])) {
      for (const workspace of page)
        selected.push(...(await readSessionHistory({ query }, { workspaceId: workspace.id })));
    }
    const rows = [...new Map(selected.map((row) => [row.id, row])).values()].sort(
      (a, b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id),
    );
    const start = Number(input.cursor ?? 0),
      limit = input.limit ?? 100;
    return {
      items: rows.slice(start, start + limit),
      nextCursor: rows.length > start + limit ? String(start + limit) : null,
    };
  };
  return [ctx, input.params] as const;
};
