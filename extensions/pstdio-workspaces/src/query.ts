import type {
  AccountDevice,
  ExtensionContextBase,
  ExtensionSession,
  KanbanRendererAttributeDescriptor,
  ResourceListRendererRow,
  WorkspaceCapacity,
} from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import { groupDevices, sessionTarget, workspaceKind, workspaceResource, workspaceTarget } from "./model";
import { workspaceCommands } from "./refs";
import { relatedChips } from "./related-chips";

type Device = Pick<AccountDevice, "id" | "name" | "online" | "current" | "lastSeenAt">;
export const listSessions = async (ctx: ExtensionContextBase, workspaceId?: string) => {
  const items: ExtensionSession[] = [];
  let cursor: string | undefined;
  do {
    const page = await ctx.sessions.query({ workspaceId, limit: 200, cursor });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
};
export const readDevices = async (ctx: ExtensionContextBase) => {
  const local = await ctx.workspaces.getCapacity();
  let devices: Device[] = [];
  try {
    devices = await ctx.account.devices();
  } catch {
    /* Local work remains usable while Cloud is unavailable. */
  }
  if (!devices.some((device) => device.id === local.deviceId))
    devices.push({
      id: local.deviceId,
      name: local.deviceName,
      online: true,
      current: true,
      lastSeenAt: new Date().toISOString(),
    });
  return { local, devices };
};
const sessionIcon = (status: string) => {
  if (status === "running") return "loader-circle";
  if (status === "awaiting_input") return "circle-help";
  if (status === "failed") return "circle-alert";
  return "message-square";
};
export const sessionRows = (sessions: ExtensionSession[], projectId: string): ResourceListRendererRow[] =>
  sessions.map((session) => ({
    id: session.id,
    title: session.title || "Session",
    icon: sessionIcon(session.status),
    target: sessionTarget(session, projectId),
    resource: sessionTarget(session, projectId).resource,
    attributes: { status: session.status, harness: session.agent ?? "", date: session.createdAt },
  }));
export const queryWorkspaces = async (ctx: ExtensionContextBase, showChildren = true) => {
  const [workspaces, sessions, { local, devices }] = await Promise.all([
    ctx.workspaces.list(),
    showChildren ? listSessions(ctx) : Promise.resolve([]),
    readDevices(ctx),
  ]);
  for (const workspace of workspaces)
    if (workspace.device && !devices.some((device) => device.id === workspace.device!.id))
      devices.push({
        id: workspace.device.id,
        name: workspace.device.name,
        current: false,
        online: false,
        lastSeenAt: workspace.updatedAt ?? "",
      });
  const ordered = groupDevices(devices);
  const capacities = new Map<string, WorkspaceCapacity>([[local.deviceId, local]]);
  await Promise.all(
    ordered
      .filter((device) => !device.current && device.online)
      .map(async (device) => {
        try {
          capacities.set(device.id, await ctx.workspaces.getCapacity({ deviceId: device.id }));
        } catch {
          /* A presence lease can outlast a disconnected device. */
        }
      }),
  );
  const cached = ((await ctx.settings.get("deviceLimits")) ?? {}) as Record<string, number | null>;
  const snapshots = { ...cached };
  for (const [id, capacity] of capacities) snapshots[id] = capacity.limit;
  if (JSON.stringify(snapshots) !== JSON.stringify(cached)) await ctx.settings.set("deviceLimits", snapshots);
  const attributes: KanbanRendererAttributeDescriptor[] = [
    {
      id: "device",
      label: "Device",
      groupable: true,
      filterable: true,
      type: {
        kind: "enum",
        options: ordered.map((device) => {
          const capacity = capacities.get(device.id);
          const limit = capacity?.limit ?? cached[device.id];
          let note = device.online
            ? "Online · Capacity unavailable"
            : `Offline · Last seen ${device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "unknown"}`;
          if (capacity) {
            note = device.current ? "This device" : "Online";
            if (capacity.limit !== null) note += ` · ${capacity.activeCount} / ${capacity.limit} active`;
          } else if (typeof limit === "number") note += ` · Limit ${limit}`;
          return {
            value: device.id,
            label: device.name,
            icon: "monitor",
            note,
            canCreate: device.current,
            noteAction: {
              kind: "command",
              target: { command: workspaceCommands.device, params: { deviceId: device.id } },
            },
          };
        }),
      },
    },
    {
      id: "type",
      label: "Type",
      filterable: true,
      groupable: true,
      displayable: true,
      type: {
        kind: "enum",
        options: [
          { value: "Git worktree", label: "Git worktree" },
          { value: "Folder", label: "Folder" },
          { value: "Remote", label: "Remote" },
        ],
      },
    },
    {
      id: "tickets",
      label: "Related",
      displayable: true,
      type: { kind: "string" },
      display: { kind: "badge-list", itemsAttributeId: "related" },
    },
    { id: "status", label: "Status", displayable: true, type: { kind: "string" } },
    { id: "harness", label: "Harness", displayable: true, type: { kind: "string" } },
    { id: "date", label: "Created", sortable: true, displayable: true, type: { kind: "date" } },
  ];
  const links: Awaited<ReturnType<typeof ctx.resources.queryAnchorsMany>>["items"] = [];
  for (let index = 0; index < workspaces.length; index += 100) {
    let cursor: string | undefined;
    do {
      const page = await ctx.resources.queryAnchorsMany({
        resources: workspaces
          .slice(index, index + 100)
          .map((workspace) => workspaceResource(workspace, ctx.project.id)),
        direction: "outgoing",
        limit: 100,
        cursor,
      });
      links.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }
  const refs = [...new Map(links.map((link) => [resourceKey(link.target), link.target])).values()];
  const related: Awaited<ReturnType<typeof ctx.resources.resolveMany>> = [];
  for (let index = 0; index < refs.length; index += 100)
    related.push(...(await ctx.resources.resolveMany(refs.slice(index, index + 100))));
  const rows: ResourceListRendererRow[] = workspaces.map((workspace) => ({
    id: workspace.id,
    title: workspace.name || workspace.shorthand || workspace.id,
    icon: workspaceResource(workspace, ctx.project.id).icon,
    target: workspaceTarget(workspace, ctx.project.id),
    resource: workspaceResource(workspace, ctx.project.id),
    attributes: {
      id: workspace.shorthand ?? workspace.id,
      device: workspace.device?.id ?? local.deviceId,
      type: workspaceKind(workspace),
      date: workspace.createdAt ?? "",
      related: relatedChips(
        links.filter((link) => link.source.id === workspace.id).map((link) => link.target),
        related,
      ),
    },
    ...(showChildren
      ? {
          children: sessionRows(
            sessions.filter((session) => session.workspaceId === workspace.id),
            ctx.project.id,
          ),
        }
      : {}),
  }));
  return { rows, attributes };
};
