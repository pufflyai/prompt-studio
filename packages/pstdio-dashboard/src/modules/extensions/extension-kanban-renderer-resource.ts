import { standardResourceIcons } from "@pstdio/workbench/core";
import { createDashboardResource } from "@/shared/app/resources";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

type ExtensionKanbanRendererRecord = NonNullable<DashboardExtensionMetadata["kanbanRenderers"]>[number];

const ticketBoardIcon = "square-kanban";
const ticketResourceIcon = "component";

export const kanbanRendererIcon = (record: ExtensionKanbanRendererRecord) =>
  record.resourceKind === "ticket" ? ticketBoardIcon : standardResourceIcons.kanbanRenderer;

export const kanbanRendererResourceKindIcon = (record: ExtensionKanbanRendererRecord) =>
  record.resourceKind === "ticket" ? ticketResourceIcon : standardResourceIcons.kanbanRenderer;

// Each extension kanban renderer is browsable like a built-in dashboard view, so it
// shows up in the project sidenav and opens its widget through the shared opener.
export const createExtensionKanbanRendererResource = (record: ExtensionKanbanRendererRecord, projectId: string) =>
  createDashboardResource(
    "dashboard-view",
    record.id,
    resolveLocalizableString(record.title, record.extensionId),
    kanbanRendererIcon(record),
    projectId,
    {
      kanbanRendererId: record.id,
      ...(record.resourceKind === "ticket" ? { collectionId: "tickets" } : {}),
    },
  );
