import type { NavigationTargetPage, NavigationTargetPanel, PageSlot } from "@pstdio/sdk/extensions";
import { ticketResourceKind } from "../resource-kinds";

export const ticketPreviewPanel = {
  id: "ticket-preview",
  region: "side",
  item: {
    kind: "binding",
    binding: {
      kinds: [ticketResourceKind.ref],
      view: { kind: "view", id: "ticket-editor" },
      cardinality: "many",
    },
  },
} satisfies PageSlot;

export const timelineTicketPreviewTarget = (target: NavigationTargetPage) => {
  return {
    kind: "panel",
    panel: {
      kind: "page-slot",
      page: { kind: "page", id: "timeline", extensionId: "pstdio.planner" },
      id: ticketPreviewPanel.id,
    },
    resource: target.resource,
    open: "preview",
  } satisfies NavigationTargetPanel;
};
