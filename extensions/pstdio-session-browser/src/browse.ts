import {
  defineCommandPaletteResource,
  type ExtensionContextBase,
  type ExtensionSession,
  l10n,
  type TreeNode,
  type TreeRendererPageParams,
  type TreeRendererQueryParams,
  type TreeViewSection,
  viewDataEvents,
  workbenchResourceKinds,
} from "@pstdio/sdk/extensions";
import { sessionBrowser } from "../refs";
import { create } from "./navigation";
import { sessionResource, sessionTarget } from "./resource";
import { pinSession, readPinnedSessions, readSessionAttention } from "./session-attention";
import { sessionDisplayStatus, sessionIndicator } from "./session-indicator";

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
// Keep date groups aligned with the public query's lastActivity ordering.
const sessionActivityDate = (session: ExtensionSession) =>
  new Date(
    Math.max(
      ...[session.createdAt, session.updatedAt, session.lastRequestStarted, session.lastRequestEnded]
        .filter((timestamp) => timestamp != null)
        .map((timestamp) => Date.parse(timestamp)),
    ),
  );
const sessionNodes = async (
  ctx: ExtensionContextBase,
  sessions: Awaited<ReturnType<typeof ctx.sessions.query>>["items"],
  workspaceId?: string,
  pinned = false,
) => {
  const attention = await readSessionAttention(ctx, sessions);
  const nodes: TreeNode[] = [];
  let date = "";
  for (const session of sessions) {
    const state = attention.get(session.id)!;
    if (state.pinned !== pinned) continue;
    const activityDate = sessionActivityDate(session);
    const day = activityDate.toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
    if (!pinned && day !== date) {
      date = day;
      nodes.push({
        id: `date:${date}`,
        label: sessionDayLabel(activityDate),
        disabled: true,
      });
    }
    const resource = sessionResource(session, ctx.projectId);
    const status = sessionDisplayStatus(session);
    nodes.push({
      id: session.id,
      label: session.title,
      icon: icons[status] ?? "circle-dashed",
      iconColor: sessionStatusColor(status),
      resource,
      indicator: state.unread
        ? { icon: "dot", color: "fg.info", label: l10n("sessions.newActivity", "New activity") }
        : undefined,
      contextMenuActions: [
        {
          id: "pin",
          label: state.pinned ? l10n("commands.unpin", "Unpin session") : l10n("commands.pin", "Pin session"),
          icon: state.pinned ? "pin-off" : "pin",
          command: pinSession.ref,
          params: { sessionId: session.id, pinned: !state.pinned },
        },
      ],
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
  const nodes = await sessionNodes(ctx, page.items, workspaceId);
  return { nodes, workspaceId, nextCursor: page.nextCursor ?? undefined };
};
export const browsePage = async (ctx: ExtensionContextBase, input: TreeRendererPageParams) => {
  if (input.cursor.startsWith("pinned:")) {
    const workspaceId = input.renderer.resource?.type === "workspace" ? input.renderer.resource.id : undefined;
    const page = await readPinnedSessions(ctx, workspaceId, input.filter?.trim(), input.cursor.slice(7));
    return {
      nodes: await sessionNodes(ctx, page.items, workspaceId, true),
      nextCursor: page.nextCursor ? `pinned:${page.nextCursor}` : undefined,
    };
  }
  const { nodes, nextCursor } = await queryPage(ctx, input, input.cursor);
  return { nodes, nextCursor };
};
export const browse = async (ctx: ExtensionContextBase, input: TreeRendererQueryParams): Promise<TreeViewSection[]> => {
  const { nodes, workspaceId, nextCursor } = await queryPage(ctx, input);
  const pinned = await readPinnedSessions(ctx, workspaceId, input.filter?.trim());
  let visibleNodes: TreeNode[] =
    nodes.length || nextCursor || pinned.items.length || pinned.nextCursor
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
        nextCursor,
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
    ...(pinned.items.length || pinned.nextCursor
      ? [
          {
            id: "pinned",
            label: l10n("sessions.pinned", "Pinned"),
            collapsible: false,
            nodes: await sessionNodes(ctx, pinned.items, workspaceId, true),
            nextCursor: pinned.nextCursor ? `pinned:${pinned.nextCursor}` : undefined,
          },
        ]
      : []),
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
      nextCursor: workspaceId ? undefined : nextCursor,
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
        indicator: sessionIndicator(sessionDisplayStatus(session)),
        target: sessionTarget(sessionResource(session, ctx.projectId)),
      })),
    };
  },
});
