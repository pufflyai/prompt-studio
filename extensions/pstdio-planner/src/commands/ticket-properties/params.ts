import { type Localizable, l10n } from "@pstdio/sdk/extensions";
import type { PropertyParam, ResourceOption, ResourceParam } from "@pstdio/ui";
import { isSingleSelectTicketTag, ticketTagAttributeId } from "../../data/mappers";
import type { StoredStatus, StoredTag, StoredTicket } from "../../data/types";
import { reviewLinkLabel, reviewLinkTooltip } from "../../views/review-link-values";
import { formatTicketUpdatedAt } from "../../views/ticket-properties-values";

export interface TicketRef {
  id: string;
  label: string;
}

export interface TicketPropertiesInput {
  ticket: StoredTicket;
  statuses: StoredStatus[];
  tags: StoredTag[];
  dependencies: TicketRef[];
  parent: TicketRef | null;
}

// Labels are localized by the host, so the query command emits `l10n()` tokens; the
// dashboard resolves them before rendering. Value/option text stays as-is (user data).
type WireProperty = Omit<PropertyParam, "name" | "value"> & { name: Localizable; value: Localizable };
type WireResource = Omit<ResourceParam, "name" | "emptyText" | "placeholder"> & {
  name: Localizable;
  emptyText?: Localizable;
  placeholder?: Localizable;
};
export type WireParam = WireProperty | WireResource;

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const property = (id: string, name: Localizable, value: Localizable): WireProperty => ({
  id,
  name,
  type: "property",
  value,
});

const idParam = (ticket: StoredTicket): WireResource => ({
  id: "id",
  name: l10n("displayMenu.orderingOptions.shorthand", "ID"),
  type: "resource",
  defaultValue: ticket.shorthand,
  options: [{ id: ticket.shorthand, name: ticket.shorthand, icon: "circle", copyText: ticket.shorthand }],
});

const statusParam = (ticket: StoredTicket, statuses: StoredStatus[]): WireResource => ({
  id: "status",
  name: l10n("displayMenu.propertyOptions.status", "Status"),
  type: "resource",
  editable: true,
  defaultValue: ticket.statusId ?? "",
  emptyText: l10n("ticketProperties.noStatus", "No status"),
  options: statuses.map((status) => ({
    id: status.id,
    name: status.name,
    color: status.color,
    icon: status.icon ?? undefined,
  })),
});

const tagParam = (ticket: StoredTicket, tag: StoredTag): WireResource => {
  const single = isSingleSelectTicketTag(tag);
  const optionIds = new Set(tag.options.map((option) => option.id));
  const selected = (ticket.tagIds ?? []).filter((id) => optionIds.has(id));
  const options: ResourceOption[] = tag.options.map((option) => ({
    id: option.id,
    name: option.name,
    color: option.color,
    icon: option.icon ?? undefined,
    description: option.description ?? undefined,
  }));

  return {
    id: ticketTagAttributeId(tag),
    name: capitalize(tag.name),
    type: "resource",
    editable: true,
    multiSelect: !single,
    defaultValue: single ? (selected[0] ?? "") : selected,
    emptyText: l10n("ticketDetail.none", "None"),
    options,
  };
};

const reviewLinksParam = (ticket: StoredTicket): WireResource => {
  const links = ticket.reviewLinks ?? [];
  return {
    id: "review-links",
    name: l10n("ticketDetail.reviewLinks", "Review links"),
    type: "resource",
    multiSelect: true,
    emptyText: l10n("ticketDetail.none", "None"),
    defaultValue: links.map((link) => link.id ?? link.url),
    options: links.map((link) => ({
      id: link.id ?? link.url,
      name: reviewLinkLabel(link),
      href: link.url,
      icon: "code",
      description: reviewLinkTooltip(link),
    })),
  };
};

const ticketRefParam = (
  id: string,
  name: Localizable,
  refs: TicketRef[],
  options: { multiSelect: boolean },
): WireResource => ({
  id,
  name,
  type: "resource",
  multiSelect: options.multiSelect,
  emptyText: l10n("ticketDetail.none", "None"),
  defaultValue: options.multiSelect ? refs.map((ref) => ref.id) : (refs[0]?.id ?? ""),
  options: refs.map((ref) => ({ id: ref.id, name: ref.label, icon: "circle", ref: { type: "ticket", id: ref.id } })),
});

// Maps a ticket into the ParamEditor rows the controls renderer displays: read-only
// property text, the copyable ID chip, editable status/tag resource dropdowns, and
// panel-only ticket/review resource chips (which open via href or the host).
export const buildTicketPropertiesControls = (input: TicketPropertiesInput) => {
  const { ticket, statuses, tags, dependencies, parent } = input;

  const params: WireParam[] = [
    idParam(ticket),
    property("updated", l10n("ticketDetail.updatedAt", "Updated at"), formatTicketUpdatedAt(ticket.updatedAt)),
    reviewLinksParam(ticket),
    statusParam(ticket, statuses),
    ...(ticket.archived
      ? [property("archived", l10n("ticketDetail.archived", "Archived"), l10n("ticketDetail.yes", "Yes"))]
      : []),
    ...(ticket.blockedReason
      ? [property("blocked-reason", l10n("ticketDetail.blockedReason", "Blocked reason"), ticket.blockedReason)]
      : []),
    ticketRefParam("depends-on", l10n("ticketDetail.dependsOn", "Depends on"), dependencies, { multiSelect: true }),
    ticketRefParam("parent", l10n("ticketDetail.parent", "Parent"), parent ? [parent] : [], { multiSelect: false }),
    ...tags.map((tag) => tagParam(ticket, tag)),
  ];

  return { params, readOnly: false as const };
};
