import { l10n, type TreeViewSectionStructure } from "@pstdio/sdk/extensions";
import { TICKET_RESOURCE_ICON } from "./data/mappers";

export const ticketNavigationStructure: TreeViewSectionStructure[] = [
  { id: "ticket", collapsible: false, resourceNode: { id: "__ticket__", icon: TICKET_RESOURCE_ICON } },
  { id: "files", label: l10n("navigation.files", "Files") },
  { id: "workspaces", label: l10n("navigation.workspaces", "Workspaces") },
  { id: "sessions", label: l10n("navigation.sessions", "Sessions") },
];
