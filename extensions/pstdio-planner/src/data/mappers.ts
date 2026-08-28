import type {
  CollectionBadgeItem,
  ExtensionWorkspace,
  KanbanRendererAttributeDescriptor,
  KanbanRendererBoardColumnConfig,
  KanbanRendererEnumOption,
  Localizable,
  StatusRef,
} from "@pstdio/sdk/extensions";
import { l10n } from "@pstdio/sdk/extensions";
import { bySortOrder } from "../utils/sort";
import {
  resolveTicketHierarchy,
  type TicketParentLookup,
  type TicketResourceReference,
  ticketDisplayTitle,
} from "./ticket-resource-hierarchy";
import type { StoredStatus, StoredTag, StoredTicket } from "./types";
import type { TicketWorkspaceSession, TicketWorkspaceSessionLookup } from "./workspace-sessions";
import { ticketShorthandFromWorkspace } from "./workspace-ticket-link";

export { ticketDisplayTitle } from "./ticket-resource-hierarchy";

export const TICKET_RESOURCE_KIND = "ticket";
export const TICKET_RESOURCE_ICON = "component";
export const TICKET_WORKSPACE_ATTRIBUTE_ID = "workspace";
export const TICKET_WORKSPACE_ITEMS_ATTRIBUTE_ID = "workspaceItems";
export const TICKET_ARCHIVE_STATE_ATTRIBUTE_ID = "archived";
export const TICKET_ARCHIVE_STATE_ACTIVE = "active";
export const TICKET_ARCHIVE_STATE_ARCHIVED = "archived";

const COLUMN_ACTION_LABELS: Record<string, Localizable<string>> = {
  archive_all: l10n("boardView.archiveAll", "Archive all"),
};

const COLUMN_ACTION_ICONS: Record<string, string> = {
  archive_all: "archive",
};

type TagOptionsLookup = Array<{ tag: StoredTag; optionIds: Set<string> }>;
export type TicketWorkspaceBadgeItem = CollectionBadgeItem & {
  createdAt?: string;
  resourceParent?: TicketResourceReference;
  session?: TicketWorkspaceSession;
};
export type TicketWorkspaceLookup = Map<string, TicketWorkspaceBadgeItem[]>;

const DEFAULT_TAG_ATTRIBUTE_IDS: Record<string, string> = {
  "default-priority": "priority",
  "default-type": "type",
  "default-complexity": "complexity",
};
const CIRCLE_ICON = "circle";

export const ticketTagAttributeId = (tag: StoredTag) => DEFAULT_TAG_ATTRIBUTE_IDS[tag.id] ?? tag.id;

export const createTicketParentLookup = (tickets: StoredTicket[]) =>
  new Map(tickets.map((ticket) => [ticket.id, ticket]));

// Existing projects may have seeded the planner-owned Type tag before it became scalar.
export const isSingleSelectTicketTag = (tag: StoredTag) => tag.type === "single_select" || tag.id === "default-type";

const createTagOptionsLookup = (tags: StoredTag[]) =>
  tags.map((tag) => ({
    tag,
    optionIds: new Set(tag.options.map((option) => option.id)),
  }));

const ticketTagValues = (ticket: StoredTicket, tagOptions: TagOptionsLookup) =>
  Object.fromEntries(
    tagOptions.map(({ optionIds, tag }) => {
      const selected = (ticket.tagIds ?? []).filter((id) => optionIds.has(id));
      return [ticketTagAttributeId(tag), isSingleSelectTicketTag(tag) ? (selected[0] ?? "") : selected];
    }),
  );

const workspaceDisplayName = (workspace: ExtensionWorkspace) => {
  const name = workspace.name?.trim();
  if (name) return name;
  const shorthand = workspace.workspace_shorthand?.trim();
  if (shorthand) return shorthand;
  return workspace.id;
};

const workspaceToBadgeItem = (
  workspace: ExtensionWorkspace,
  session: TicketWorkspaceSession | undefined,
): TicketWorkspaceBadgeItem => ({
  id: workspace.id,
  label: workspace.workspace_shorthand?.trim() || workspaceDisplayName(workspace),
  icon: workspace.worktree_path ? "GitBranch" : "GitCommit",
  resource: {
    type: "workspace",
    id: workspace.id,
    label: workspaceDisplayName(workspace),
    metadata: {
      workspaceId: workspace.id,
      workspaceType: workspace.worktree_path ? "worktree" : "current_branch",
      ...(workspace.workspace_shorthand ? { workspaceShorthand: workspace.workspace_shorthand } : {}),
    },
  },
  ...(workspace.created_at ? { createdAt: workspace.created_at } : {}),
  // Carried per workspace so switching among a ticket's workspaces never shows another one's status.
  ...(session ? { session } : {}),
});

const byNewestWorkspace = (left: TicketWorkspaceBadgeItem, right: TicketWorkspaceBadgeItem) =>
  (right.createdAt ?? "").localeCompare(left.createdAt ?? "") ||
  right.label.localeCompare(left.label, undefined, { numeric: true });

export const createTicketWorkspaceLookup = (
  workspaces: ExtensionWorkspace[] = [],
  sessions: TicketWorkspaceSessionLookup = new Map(),
) => {
  const lookup: TicketWorkspaceLookup = new Map();

  for (const workspace of workspaces) {
    const ticketShorthand = ticketShorthandFromWorkspace(workspace);
    if (!ticketShorthand) continue;
    const items = lookup.get(ticketShorthand) ?? [];
    items.push(workspaceToBadgeItem(workspace, sessions.get(workspace.id)));
    lookup.set(ticketShorthand, items);
  }

  for (const items of lookup.values()) items.sort(byNewestWorkspace);
  return lookup;
};

const ticketWorkspaceValues = (
  ticket: StoredTicket,
  workspaceLookup: TicketWorkspaceLookup,
  resourceReference: TicketResourceReference,
) => {
  const parentMetadata = { resourceParent: resourceReference };
  const items = (workspaceLookup.get(ticket.shorthand) ?? []).map((item) => ({
    ...item,
    ...parentMetadata,
    resource: item.resource
      ? { ...item.resource, metadata: { ...item.resource.metadata, ...parentMetadata } }
      : undefined,
  }));
  return {
    [TICKET_WORKSPACE_ATTRIBUTE_ID]: items[0]?.id ?? "",
    [TICKET_WORKSPACE_ITEMS_ATTRIBUTE_ID]: items,
  };
};

const ticketToRowWithTags = (
  ticket: StoredTicket,
  projectId: string,
  tagOptions: TagOptionsLookup,
  workspaceLookup: TicketWorkspaceLookup,
  parentLookup: TicketParentLookup,
) => {
  const hierarchy = resolveTicketHierarchy(ticket, parentLookup);

  return {
    id: ticket.id,
    // Card/list rows show the bare title; shorthand ancestry stays in the "id"
    // attribute while the resource label remains the navigation title.
    title: ticket.title || ticket.shorthand,
    resource: {
      type: TICKET_RESOURCE_KIND,
      id: ticket.id,
      projectId,
      label: ticketDisplayTitle(ticket),
      icon: TICKET_RESOURCE_ICON,
      metadata: hierarchy.resourceReference.metadata,
    },
    attributes: {
      status: ticket.statusId ?? "",
      [TICKET_ARCHIVE_STATE_ATTRIBUTE_ID]: ticket.archived
        ? TICKET_ARCHIVE_STATE_ARCHIVED
        : TICKET_ARCHIVE_STATE_ACTIVE,
      created: ticket.createdAt,
      updated: ticket.updatedAt,
      id: hierarchy.breadcrumb,
      parent: hierarchy.parent?.shorthand ?? "",
      ...ticketWorkspaceValues(ticket, workspaceLookup, hierarchy.resourceReference),
      ...ticketTagValues(ticket, tagOptions),
    },
  };
};

export const ticketToRow = (
  ticket: StoredTicket,
  projectId: string,
  tags: StoredTag[] = [],
  workspaceLookup: TicketWorkspaceLookup = new Map(),
  parentLookup: TicketParentLookup = new Map(),
) => ticketToRowWithTags(ticket, projectId, createTagOptionsLookup(tags), workspaceLookup, parentLookup);

export const createTicketRowMapper = (
  projectId: string,
  tags: StoredTag[] = [],
  workspaceLookup: TicketWorkspaceLookup = new Map(),
  parentLookup: TicketParentLookup = new Map(),
) => {
  const tagOptions = createTagOptionsLookup(tags);
  return (ticket: StoredTicket) => ticketToRowWithTags(ticket, projectId, tagOptions, workspaceLookup, parentLookup);
};

const statusToOption = (status: StoredStatus): KanbanRendererEnumOption => ({
  value: status.id,
  label: status.name,
  color: status.color,
  icon: status.icon ?? CIRCLE_ICON,
});

const tagToAttribute = (tag: StoredTag): KanbanRendererAttributeDescriptor => ({
  id: ticketTagAttributeId(tag),
  label: tag.name,
  type: {
    kind: isSingleSelectTicketTag(tag) ? "enum" : "enum-multi",
    options: [...tag.options].sort(bySortOrder).map((option) => ({
      value: option.id,
      label: option.name,
      color: option.color,
      icon: option.icon,
    })),
  },
  filterable: true,
  displayable: true,
  editable: true,
  groupable: isSingleSelectTicketTag(tag),
});

export const buildTicketAttributes = (
  statuses: StoredStatus[] | StatusRef,
  tags: StoredTag[] = [],
): KanbanRendererAttributeDescriptor[] => [
  {
    id: "status",
    label: l10n("displayMenu.propertyOptions.status", "Status"),
    type: Array.isArray(statuses)
      ? { kind: "enum", options: [...statuses].sort(bySortOrder).map(statusToOption) }
      : { kind: "status", statuses },
    groupable: true,
    filterable: true,
    displayable: true,
    editable: true,
  },
  {
    id: TICKET_ARCHIVE_STATE_ATTRIBUTE_ID,
    label: l10n("displayMenu.propertyOptions.archived", "Archived"),
    type: {
      kind: "enum",
      options: [
        { value: TICKET_ARCHIVE_STATE_ACTIVE, label: l10n("archiveState.active", "Active") },
        { value: TICKET_ARCHIVE_STATE_ARCHIVED, label: l10n("archiveState.archived", "Archived") },
      ],
    },
    filterable: true,
    editable: false,
  },
  {
    id: "created",
    label: l10n("displayMenu.propertyOptions.createdAt", "Created"),
    type: { kind: "date" },
    sortable: true,
    displayable: true,
  },
  {
    id: "updated",
    label: l10n("displayMenu.propertyOptions.updatedAt", "Updated"),
    type: { kind: "date" },
    sortable: true,
    displayable: true,
  },
  { id: "id", label: l10n("displayMenu.orderingOptions.shorthand", "ID"), type: { kind: "string" }, displayable: true },
  {
    id: "parent",
    label: l10n("displayMenu.propertyOptions.parent", "Parent"),
    type: { kind: "string" },
    filterable: true,
  },
  {
    id: TICKET_WORKSPACE_ATTRIBUTE_ID,
    label: l10n("displayMenu.propertyOptions.workspace", "Workspace"),
    type: { kind: "string" },
    displayable: true,
    display: { kind: "badge-list", itemsAttributeId: TICKET_WORKSPACE_ITEMS_ATTRIBUTE_ID },
  },
  ...[...tags].sort(bySortOrder).map(tagToAttribute),
];

export const statusToColumnConfig = (status: StoredStatus): KanbanRendererBoardColumnConfig => ({
  color: status.color,
  canDragIn: status.canDragIn,
  canDragOut: status.canDragOut,
  canCreate: status.canCreate,
  actions: status.columnActions.map((id) => ({
    id,
    label: COLUMN_ACTION_LABELS[id] ?? id,
    icon: COLUMN_ACTION_ICONS[id],
  })),
});
