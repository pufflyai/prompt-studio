import {
  defineCommandPaletteResource,
  type ExtensionContextBase,
  l10n,
  type TreeNode,
  type TreeRendererChildrenParams,
  type TreeRendererQueryParams,
  type TreeViewSection,
  viewDataEvents,
  workbenchResourceKinds,
} from "@pstdio/sdk/extensions";
import { sessionBrowser } from "../refs";
import { create } from "./navigation";
import { sessionResource, sessionTarget } from "./resource";

const icons: Record<string, string> = {
  completed: "circle-check",
  failed: "circle-alert",
  cancelled: "circle-stop",
  disconnected: "circle-pause",
  queued: "clock-alert",
  awaiting_input: "circle-dot",
};
const sessionStatusColor = (status: string) => {
  if (status === "completed") return "fg.success";
  if (status === "failed") return "fg.error";
  if (status === "cancelled" || status === "disconnected") return "fg.warning";
  if (status === "queued") return "fg.info";
  return "fg.muted";
};
const sessionDayLabel = (date: Date) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const savedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round((today.getTime() - savedDay.getTime()) / 86_400_000);
  if (daysAgo === 0) return l10n("sessions.today", "Today");
  if (daysAgo === 1) return l10n("sessions.yesterday", "Yesterday");
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
};
const sessionNodes = (
  ctx: ExtensionContextBase,
  sessions: Awaited<ReturnType<typeof ctx.sessions.query>>["items"],
  cursor?: string,
  workspaceId?: string,
) => {
  const nodes: TreeNode[] = [];
  let date = "";
  for (const session of sessions) {
    const day = new Date(session.lastRequestStarted ?? session.updatedAt).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
    if (day !== date) {
      date = day;
      nodes.push({
        id: `date:${cursor ?? "root"}:${date}`,
        label: sessionDayLabel(new Date(session.lastRequestStarted ?? session.updatedAt)),
        disabled: true,
      });
    }
    const resource = sessionResource(session, ctx.projectId);
    nodes.push({
      id: session.id,
      label: session.title,
      icon: icons[session.status] ?? "circle-dashed",
      iconColor: sessionStatusColor(session.status),
      resource,
      target: workspaceId
        ? { kind: "panel", panel: sessionBrowser.panels.conversation, resource, open: "preview" }
        : sessionTarget(resource),
    });
  }
  return nodes;
};
const queryPage = async (ctx: ExtensionContextBase, input: TreeRendererQueryParams, cursor?: string) => {
  const workspaceId = input.renderer.resource?.type === "workspace" ? input.renderer.resource.id : undefined;
  const page = await ctx.sessions.query({
    limit: 50,
    orderBy: "lastActivity",
    workspaceId,
    search: input.filter?.trim() || undefined,
    ...(cursor ? { cursor } : {}),
  });
  const nodes = sessionNodes(ctx, page.items, cursor, workspaceId);
  if (page.nextCursor)
    nodes.push({
      id: `more:${page.nextCursor}`,
      label: l10n("sessions.more", "More sessions"),
      collapsible: true,
      metadata: { cursor: page.nextCursor },
    });
  return { nodes, workspaceId };
};
export const browseChildren = async (ctx: ExtensionContextBase, input: TreeRendererChildrenParams) => {
  const cursor = input.node.metadata?.cursor;
  if (typeof cursor !== "string") return [];
  return (await queryPage(ctx, input, cursor)).nodes;
};
export const browse = async (ctx: ExtensionContextBase, input: TreeRendererQueryParams): Promise<TreeViewSection[]> => {
  const { nodes, workspaceId } = await queryPage(ctx, input);
  let visibleNodes: TreeNode[] = nodes.length
    ? nodes
    : [{ id: "empty", label: l10n("sessions.empty", "No sessions yet"), disabled: true }];
  if (workspaceId)
    visibleNodes = [
      {
        id: "workspace-sessions",
        label: l10n("sessions.title", "Sessions"),
        collapsible: true,
        canHide: true,
        children: nodes,
        actions: [
          {
            id: "new",
            label: l10n("commands.new", "New session"),
            icon: "plus",
            command: create.ref,
            params: { workspaceId, side: true },
          },
        ],
      },
    ];
  return [
    {
      id: "sessions",
      label: l10n("sessions.title", "Sessions"),
      collapsible: false,
      actions: [
        {
          id: "new",
          label: l10n("commands.new", "New session"),
          icon: "plus",
          command: create.ref,
          params: workspaceId ? { workspaceId } : {},
        },
      ],
      nodes: visibleNodes,
    },
  ];
};
export const search = defineCommandPaletteResource({
  id: "sessions",
  title: l10n("sessions.title", "Sessions"),
  resourceKind: workbenchResourceKinds.session,
  refreshEvents: [viewDataEvents.sessionsChanged],
  async query(ctx, input) {
    const sessions: Awaited<ReturnType<typeof ctx.sessions.query>>["items"] = [];
    let cursor: string | undefined;
    while (sessions.length < input.limit) {
      const page = await ctx.sessions.query({
        limit: Math.min(200, input.limit - sessions.length),
        orderBy: "lastActivity",
        search: input.query.trim() || undefined,
        ...(cursor ? { cursor } : {}),
      });
      sessions.push(...page.items);
      cursor = page.nextCursor ?? undefined;
      if (!cursor) break;
    }
    return {
      items: sessions.map((session) => ({
        id: session.id,
        label: session.title,
        icon: "message-circle",
        indicator: { icon: icons[session.status] ?? "circle-dashed", label: `Session status: ${session.status}` },
        target: sessionTarget(sessionResource(session, ctx.projectId)),
      })),
    };
  },
});
