import type {
  DataRendererAttributeDescriptor,
  DataRendererBoardColumnConfig,
  DataRendererEnumOption,
  ExtensionWorkspace,
  Localizable,
} from "@pstdio/sdk/extensions";
import { l10n } from "@pstdio/sdk/extensions";
import { bySortOrder } from "../utils/sort";
import {
  type TicketParentLookup,
  ticketBreadcrumbResourceMetadata,
  ticketDisplayTitle,
  ticketParentResourceMetadata,
} from "./ticket-breadcrumb";
import type { StoredStatus, StoredTag, StoredTicket } from "./types";
import { ticketShorthandFromWorkspace } from "./workspace-ticket-link";

export { ticketDisplayTitle, ticketParentResourceMetadata } from "./ticket-breadcrumb";

export const TICKET_RESOURCE_KIND = "ticket";
export const TICKET_RESOURCE_ICON = "component";
export const TICKET_WORKSPACE_ATTRIBUTE_ID = "workspace";
export const TICKET_WORKSPACE_ITEMS_ATTRIBUTE_ID = "workspaceItems";

const COLUMN_ACTION_LABELS: Record<string, Localizable<string>> = {
  archive_all: l10n("boardView.archiveAll", "Archive all"),
};

const COLUMN_ACTION_ICONS: Record<string, string> = {
  archive_all: "archive",
};

type TagOptionsLookup = Array<{ tag: StoredTag; optionIds: Set<string> }>;
export type TicketWorkspaceBadgeItem = {
  id: string;
  name: string;
  shorthand?: string;
  type: "worktree" | "current_branch";
  createdAt?: string;
  ticketId?: string;
  ticketLabel?: string;
  ticketShorthand?: string;
  ticketBreadcrumb?: Array<{ id: string; label: string; shorthand: string }>;
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
const isSingleSelectTicketTag = (tag: StoredTag) => tag.type === "single_select" || tag.id === "default-type";

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

const workspaceToBadgeItem = (workspace: ExtensionWorkspace): TicketWorkspaceBadgeItem => ({
  id: workspace.id,
  name: workspaceDisplayName(workspace),
  ...(workspace.workspace_shorthand ? { shorthand: workspace.workspace_shorthand } : {}),
  type: workspace.worktree_path ? "worktree" : "current_branch",
  ...(workspace.created_at ? { createdAt: workspace.created_at } : {}),
});

const byNewestWorkspace = (left: TicketWorkspaceBadgeItem, right: TicketWorkspaceBadgeItem) =>
  (right.createdAt ?? "").localeCompare(left.createdAt ?? "") ||
  (right.shorthand ?? right.id).localeCompare(left.shorthand ?? left.id, undefined, { numeric: true });

export const createTicketWorkspaceLookup = (workspaces: ExtensionWorkspace[] = []) => {
  const lookup: TicketWorkspaceLookup = new Map();

  for (const workspace of workspaces) {
    const ticketShorthand = ticketShorthandFromWorkspace(workspace);
    if (!ticketShorthand) continue;
    const items = lookup.get(ticketShorthand) ?? [];
    items.push(workspaceToBadgeItem(workspace));
    lookup.set(ticketShorthand, items);
  }

  for (const items of lookup.values()) items.sort(byNewestWorkspace);
  return lookup;
};

const ticketWorkspaceValues = (
  ticket: StoredTicket,
  workspaceLookup: TicketWorkspaceLookup,
  parentLookup: TicketParentLookup,
) => {
  const ticketMetadata = ticketBreadcrumbResourceMetadata(ticket, parentLookup);
  const items = (workspaceLookup.get(ticket.shorthand) ?? []).map((item) => ({ ...item, ...ticketMetadata }));
  return {
    [TICKET_WORKSPACE_ATTRIBUTE_ID]: items[0]?.id ?? "",
    [TICKET_WORKSPACE_ITEMS_ATTRIBUTE_ID]: items,
  };
};

const ticketParentMetadata = (ticket: StoredTicket, parentLookup: TicketParentLookup) => {
  if (!ticket.parentId) return undefined;
  const parent = parentLookup.get(ticket.parentId);
  return parent ? ticketParentResourceMetadata(parent) : undefined;
};

const ticketToRowWithTags = (
  ticket: StoredTicket,
  projectId: string,
  tagOptions: TagOptionsLookup,
  workspaceLookup: TicketWorkspaceLookup,
  parentLookup: TicketParentLookup,
) => {
  const parentMetadata = ticketParentMetadata(ticket, parentLookup);

  return {
    id: ticket.id,
    // Card/list rows show the bare title; the shorthand stays available as the "id"
    // attribute. The breadcrumb/tab keeps the shorthand via resource.label below.
    title: ticket.title || ticket.shorthand,
    resource: {
      type: TICKET_RESOURCE_KIND,
      id: ticket.id,
      projectId,
      label: ticketDisplayTitle(ticket),
      icon: TICKET_RESOURCE_ICON,
      ...(parentMetadata ? { metadata: parentMetadata } : {}),
    },
    attributes: {
      status: ticket.statusId ?? "",
      created: ticket.createdAt,
      updated: ticket.updatedAt,
      id: ticket.shorthand,
      ...ticketWorkspaceValues(ticket, workspaceLookup, parentLookup),
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

const statusToOption = (status: StoredStatus): DataRendererEnumOption => ({
  value: status.id,
  label: status.name,
  color: status.color,
  icon: CIRCLE_ICON,
});

const tagToAttribute = (tag: StoredTag): DataRendererAttributeDescriptor => ({
  id: ticketTagAttributeId(tag),
  label: tag.name,
  type: {
    kind: isSingleSelectTicketTag(tag) ? "enum" : "enum-multi",
    options: [...tag.options].sort(bySortOrder).map((option) => ({
      value: option.id,
      label: option.name,
      color: option.color,
      icon: tag.id === "default-complexity" ? CIRCLE_ICON : option.icon,
    })),
  },
  filterable: true,
  displayable: true,
  editable: true,
  groupable: isSingleSelectTicketTag(tag),
});

export const buildTicketAttributes = (
  statuses: StoredStatus[],
  tags: StoredTag[] = [],
): DataRendererAttributeDescriptor[] => [
  {
    id: "status",
    label: l10n("displayMenu.propertyOptions.status", "Status"),
    type: { kind: "enum", options: [...statuses].sort(bySortOrder).map(statusToOption) },
    groupable: true,
    filterable: true,
    displayable: true,
    editable: true,
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
    id: TICKET_WORKSPACE_ATTRIBUTE_ID,
    label: l10n("displayMenu.propertyOptions.workspace", "Workspace"),
    type: { kind: "string" },
    displayable: true,
    display: { kind: "workspace-badge", itemsAttributeId: TICKET_WORKSPACE_ITEMS_ATTRIBUTE_ID },
  },
  ...[...tags].sort(bySortOrder).map(tagToAttribute),
];

export const statusToColumnConfig = (status: StoredStatus): DataRendererBoardColumnConfig => ({
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
