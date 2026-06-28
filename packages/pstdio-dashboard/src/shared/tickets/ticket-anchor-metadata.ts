// Sessions and workspaces both anchor themselves to a planner ticket via a `type: "ticket"`
// entry in their `anchors_json`. This derives the ticket metadata the dashboard surfaces on
// those resources (so the sidebar can group/filter by ticket and breadcrumbs stay ticket-scoped)
// without the dashboard knowing anything about the planner extension internals.
type TicketAnchor = {
  type: string;
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTicketAnchor = (value: unknown): value is TicketAnchor =>
  isRecord(value) && typeof value.type === "string" && typeof value.id === "string";

const textValue = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

const ticketAnchorFromAnchors = (anchors: unknown) => {
  if (!Array.isArray(anchors)) return undefined;
  return anchors.find((anchor): anchor is TicketAnchor => isTicketAnchor(anchor) && anchor.type === "ticket");
};

const ticketShorthandFromAnchor = (anchor: TicketAnchor) => {
  const shorthand = anchor.metadata?.shorthand;
  return typeof shorthand === "string" ? shorthand : anchor.label;
};

const ticketBreadcrumbFromAnchor = (anchor: TicketAnchor) => {
  const breadcrumb = anchor.metadata?.ticketBreadcrumb;
  if (!Array.isArray(breadcrumb)) return undefined;

  const items = breadcrumb.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = textValue(item.id);
    if (!id) return [];
    const shorthand = textValue(item.shorthand);
    const label = textValue(item.label) ?? shorthand ?? id;
    return [{ id, label, ...(shorthand ? { shorthand } : {}) }];
  });

  return items.length > 0 ? items : undefined;
};

export const ticketMetadataFromAnchors = (anchors: unknown) => {
  const anchor = ticketAnchorFromAnchors(anchors);
  const ticketShorthand = anchor ? ticketShorthandFromAnchor(anchor) : undefined;
  const ticketLabel = anchor?.label ?? ticketShorthand;
  const ticketBreadcrumb = anchor ? ticketBreadcrumbFromAnchor(anchor) : undefined;

  // Conditional spreads keep every field optional so callers can both spread the result into
  // resource metadata and read `ticketId` directly without a union getting in the way.
  return {
    ...(anchor ? { ticketId: anchor.id } : {}),
    ...(ticketShorthand ? { ticketShorthand } : {}),
    ...(ticketLabel ? { ticketLabel } : {}),
    ...(ticketBreadcrumb ? { ticketBreadcrumb } : {}),
  };
};
