import {
  type CollectionBadgeItem,
  l10n,
  type ResourceRef,
  resourceKey,
  type TreeNode,
  type TreeViewSection,
} from "@pstdio/sdk/extensions";
import { createTicketParentLookup, ticketDisplayTitle } from "../data/mappers";
import { resourceLinkTarget } from "../data/resource-link-target";
import { normalizeTicketDependencies } from "../data/ticket-dependencies";
import { ticketPageTarget } from "../data/ticket-page-target";
import { ticketResourceReference } from "../data/ticket-resource-hierarchy";
import type { TicketSummary } from "../data/ticket-summary";
import type { Ticket } from "../data/types";

export const ticketRelationshipSections = (
  ticket: Ticket,
  tickets: TicketSummary[],
  extensionId = "pstdio.planner",
  requiredBy?: TicketSummary[],
  nextCursor?: string,
  dependencyPage?: { tickets: TicketSummary[]; nextCursor?: string },
) => {
  const lookup = createTicketParentLookup(tickets);
  const byReference = new Map(
    tickets.flatMap((item) => [
      [item.id, item],
      [item.shorthand, item],
    ]),
  );
  const dependencies = normalizeTicketDependencies(ticket.dependsOn);
  const groups = [
    { id: "parent", label: l10n("ticketDetail.parent", "Parent"), refs: ticket.parentId ? [ticket.parentId] : [] },
    {
      id: "depends-on",
      label: l10n("ticketDetail.dependsOn", "Depends on"),
      refs: dependencyPage?.tickets.map(({ id }) => id) ?? dependencies,
    },
    {
      id: "required-by",
      label: l10n("navigation.requiredBy", "Required by"),
      refs: (
        requiredBy ??
        tickets.filter(
          (item) =>
            !item.archived &&
            normalizeTicketDependencies(item.dependsOn).some((ref) => ref === ticket.id || ref === ticket.shorthand),
        )
      ).map((item) => item.id),
    },
  ];
  return groups.flatMap(({ refs, ...group }): TreeViewSection[] => {
    const nodes = refs.flatMap((ref) => {
      const related = byReference.get(ref);
      if (!related) return [];
      const resource = ticketResourceReference(related, lookup, extensionId);
      return [
        {
          id: `${group.id}:${related.id}`,
          label: ticketDisplayTitle(related),
          icon: "component",
          resource,
          target: resourceLinkTarget(ticketPageTarget(resource, extensionId)),
        },
      ];
    });
    let cursor: string | undefined;
    if (group.id === "required-by") cursor = nextCursor;
    if (group.id === "depends-on") cursor = dependencyPage?.nextCursor;
    return nodes.length || cursor
      ? [{ ...group, collapsible: true, nodes, ...(cursor ? { nextCursor: cursor } : {}) }]
      : [];
  });
};

// Resource anchors are queried in both directions. Merge them with the ticket's
// domain links so the same session or workspace appears once regardless of who linked it.
export const mergeTicketLinkSections = (
  sections: TreeViewSection[],
  links: CollectionBadgeItem[],
  projectId?: string,
  extensionId = "pstdio.planner",
) => {
  const key = (resource: ResourceRef) =>
    resourceKey({
      ...resource,
      projectId: resource.projectId ?? projectId,
      extensionId: resource.extensionId ?? (resource.type === "ticket" ? extensionId : "pstdio"),
    });
  const groups = new Map(
    sections.map((section) => [
      section.id,
      {
        ...section,
        nodes: section.nodes.filter((node) => node.rowVariant !== "empty-state"),
      },
    ]),
  );
  const visible = new Set(
    [...groups.values()].flatMap((section) =>
      section.nodes.map((node) => (node.resource ? key(node.resource) : node.id)),
    ),
  );
  for (const item of links) {
    const resource = item.resource;
    if (!resource || visible.has(key(resource))) continue;
    const group = ticketLinkGroup(resource);
    const section = groups.get(group.id) ?? { ...group, collapsible: true, nodes: [] };
    section.nodes.push({
      id: `link:${item.id}`,
      label: item.label,
      icon: item.icon,
      resource,
      target: item.action && resourceLinkTarget(item.action),
      disabled: !item.action,
      tooltip: item.tooltip,
    });
    groups.set(group.id, section);
    visible.add(key(resource));
  }
  const ticketNode = groups.get("ticket")?.nodes[0];
  if (ticketNode)
    ticketNode.contextMenuActions = [
      ...(ticketNode.contextMenuActions ?? []),
      ...[...groups.values()]
        .filter((section) => section.nodes.length === 0)
        .flatMap((section) => section.actions ?? []),
    ];
  return [...groups.values()].filter((section) => section.nodes.length > 0 || section.nextCursor);
};

const resourceTypeLabels: Record<string, ReturnType<typeof l10n>> = {
  ticket: l10n("navigation.tickets", "Tickets"),
  note: l10n("navigation.notes", "Notes"),
  report: l10n("navigation.reports", "Reports"),
  "pull-request": l10n("navigation.pullRequests", "Pull requests"),
  artifact: l10n("navigation.artifacts", "Artifacts"),
};

export const ticketLinkGroup = (resource: ResourceRef) => {
  const { type } = resource;
  if (type === "session") return { id: "sessions", label: l10n("navigation.sessions", "Sessions") };
  if (type === "workspace") return { id: "workspaces", label: l10n("navigation.workspaces", "Workspaces") };
  const words = type.replace(/[-_]+/g, " ");
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  return {
    id: `resource-type:${resource.extensionId ?? "pstdio"}:${type}`,
    label: Object.hasOwn(resourceTypeLabels, type) ? resourceTypeLabels[type] : `${label}s`,
  };
};

export const ticketLinkTypeNodes = (sections: TreeViewSection[]): TreeNode[] =>
  sections
    .filter((section) => section.id.startsWith("resource-type:"))
    .map((section) => ({
      id: section.id,
      label: section.label ?? "",
      collapsible: false,
      children: section.nodes,
    }));
