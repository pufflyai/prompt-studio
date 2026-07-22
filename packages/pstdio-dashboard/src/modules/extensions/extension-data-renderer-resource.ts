import { standardResourceIcons } from "@pstdio/workbench/core";
import { createDashboardResource } from "@/shared/app/resources";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

type ExtensionDataRendererRecord = NonNullable<DashboardExtensionMetadata["dataRenderers"]>[number];

const ticketBoardIcon = "square-kanban";
const ticketResourceIcon = "component";

export const dataRendererIcon = (record: ExtensionDataRendererRecord) =>
  record.resourceKind === "ticket" ? ticketBoardIcon : standardResourceIcons.dataRenderer;

export const dataRendererResourceKindIcon = (record: ExtensionDataRendererRecord) =>
  record.resourceKind === "ticket" ? ticketResourceIcon : standardResourceIcons.dataRenderer;

// Each extension data renderer is browsable like a built-in dashboard view, so it
// shows up in the project sidenav and opens its widget through the shared opener.
export const createExtensionDataRendererResource = (record: ExtensionDataRendererRecord, projectId: string) =>
  createDashboardResource(
    "dashboard-view",
    record.id,
    resolveLocalizableString(record.title, record.extensionId),
    dataRendererIcon(record),
    projectId,
    {
      dataRendererId: record.id,
      ...(record.resourceKind === "ticket" ? { collectionId: "tickets" } : {}),
    },
  );
