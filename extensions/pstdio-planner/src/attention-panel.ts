import type { NavigationTargetPanel, PageSlot, ResourceRef } from "@pstdio/sdk/extensions";
import { ticketResourceKind } from "./resource-kinds";

export const attentionPanel = {
  id: "needs-attention",
  region: "side",
  item: {
    kind: "binding",
    binding: {
      kinds: [ticketResourceKind.ref],
      view: { kind: "view", id: "ticket-requests" },
      cardinality: "one",
    },
  },
} satisfies PageSlot;

export const attentionPanelTarget = (resource: ResourceRef, page = "tickets") =>
  ({
    kind: "panel",
    panel: {
      kind: "page-slot",
      page: { kind: "page", id: page, extensionId: "pstdio.pstdio-planner" },
      id: attentionPanel.id,
    },
    resource,
  }) satisfies NavigationTargetPanel;
