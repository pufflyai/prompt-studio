import {
  type CollectionBadgeItem,
  l10n,
  type ResourceRef,
  resourceKey,
  type TreeViewSection,
} from "@pstdio/sdk/extensions";
import { createTicketParentLookup, ticketDisplayTitle } from "../data/mappers";
import { normalizeTicketDependencies } from "../data/ticket-dependencies";
import { ticketPageTarget } from "../data/ticket-page-target";
import { ticketResourceReference } from "../data/ticket-resource-hierarchy";
import type { Ticket } from "../data/types";

export const ticketRelationshipSections = (ticket: Ticket, tickets: Ticket[], extensionId = "pstdio.planner") => {
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
    { id: "depends-on", label: l10n("ticketDetail.dependsOn", "Depends on"), refs: dependencies },
    {
      id: "required-by",
      label: l10n("navigation.requiredBy", "Required by"),
      refs: tickets
        .filter(
          (item) =>
            !item.archived &&
            normalizeTicketDependencies(item.dependsOn).some((ref) => ref === ticket.id || ref === ticket.shorthand),
        )
        .map((item) => item.id),
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
          target: ticketPageTarget(resource, extensionId),
        },
      ];
    });
    return nodes.length ? [{ ...group, collapsible: true, nodes }] : [];
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
    const group = linkGroup(resource.type);
    const section = groups.get(group.id) ?? { ...group, collapsible: true, nodes: [] };
    section.nodes.push({ id: `link:${item.id}`, label: item.label, icon: item.icon, resource, target: item.action });
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
  return [...groups.values()].filter((section) => section.nodes.length > 0);
};

const linkGroup = (type: string) => {
  if (type === "session") return { id: "sessions", label: l10n("navigation.sessions", "Sessions") };
  if (type === "workspace") return { id: "workspaces", label: l10n("navigation.workspaces", "Workspaces") };
  return { id: "related", label: l10n("navigation.related", "Related resources") };
};
