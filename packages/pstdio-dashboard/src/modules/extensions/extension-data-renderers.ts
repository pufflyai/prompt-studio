import type { DataRendererResourceRef } from "@pstdio/sdk/extensions";
import type { DataRendererRow } from "@pstdio/ui";
import {
  type Disposable,
  type ResourceRef,
  standardResourceIcons,
  type TreeViewSection,
  type WorkbenchModuleContributionContext,
  type WorkbenchWidgetPlacement,
} from "pstdio-workbench/core";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { executeExtensionCommand } from "@/shared/extensions/api";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { subscribeToExtensionCommandFeed } from "@/shared/extensions/extension-webview-broadcast";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { registerResourceRoute } from "@/shared/workbench/route-helper";
import {
  buildExtensionDataRendererContribution,
  type ExtensionDataRendererRecord,
  unwrapCommandOutcome,
} from "./extension-data-renderer-contributions";
import { dashboardExtensionViewKind, extensionViewWidgetId } from "./extension-mode-layout";

type ExtensionViewRecord = DashboardExtensionMetadata["views"][number];

const ticketBoardIcon = "square-kanban";

const dataRendererIcon = (record: ExtensionDataRendererRecord) =>
  record.resourceKind === "ticket" ? ticketBoardIcon : standardResourceIcons.dataRenderer;

// Each extension data renderer is browsable like a built-in dashboard view, so it
// shows up in the project sidebar and opens its widget through the shared opener.
export const createExtensionDataRendererResource = (record: ExtensionDataRendererRecord, projectId: string) =>
  createDashboardResource(
    "dashboard-view",
    record.id,
    resolveLocalizableString(record.title, record.extensionId),
    dataRendererIcon(record),
    projectId,
    {
      dataRendererId: record.id,
    },
  );

// Rows carry a DataRendererResourceRef (type/id) which we lift into a workbench
// ResourceRef so a kind-specific opener (e.g. the ticket editor) can claim it.
const toWorkbenchResource = (resource: unknown, projectId: string): ResourceRef | undefined => {
  if (!resource || typeof resource !== "object") return undefined;
  const ref = resource as DataRendererResourceRef & { icon?: string };
  return {
    kind: ref.type,
    uri: `dashboard-workbench://${ref.type}/${ref.id}`,
    id: ref.id,
    label: ref.label ?? ref.id,
    icon: ref.icon ?? standardResourceIcons.dataRenderer,
    metadata: { ...ref.metadata, projectId: ref.projectId ?? projectId },
  };
};

// A modal view shares the data renderer's resourceKind but mounts as an overlay; the
// board create button opens it (pre-pointed at the target column) instead of inline
// creating. The create command runs inside the modal webview, so we listen on the
// command feed to close the dialog and refresh the board once it succeeds.
const createModalController = (input: {
  ctx: WorkbenchModuleContributionContext;
  modalView: ExtensionViewRecord;
  projectId: string;
  createCommandId: string | undefined;
  refresh: () => void;
}) => {
  const { ctx, modalView, projectId, createCommandId, refresh } = input;
  const widgetId = extensionViewWidgetId(modalView.id);
  let activePlacement: WorkbenchWidgetPlacement | undefined;

  const close = () => {
    if (!activePlacement) return;
    ctx.layout.closeWidget(activePlacement.widgetId);
    activePlacement = undefined;
  };

  const openCreateModal = (columnId: string) => {
    activePlacement = ctx.layout.openWidget(widgetId, {
      title: modalView.title,
      resource: {
        kind: dashboardExtensionViewKind,
        uri: `dashboard-workbench://project/${projectId}/create/${modalView.id}/${columnId}`,
        id: columnId,
        label: resolveLocalizableString(modalView.title, modalView.extensionId),
        // The renderer derives the modal view from its widget id + cached manifest (PS-11),
        // so the view record is not stored on the resource.
        metadata: { extensionId: modalView.extensionId, projectId },
      },
    });
  };

  const unsubscribe = createCommandId
    ? subscribeToExtensionCommandFeed((event) => {
        if (event.commandId !== createCommandId || !event.outcome.ok || !activePlacement) return;
        close();
        refresh();
      })
    : () => undefined;

  return { openCreateModal, dispose: unsubscribe };
};

export const registerExtensionDataRenderers = (
  ctx: WorkbenchModuleContributionContext,
  input: { metadata: DashboardExtensionMetadata; projectId: string },
) => {
  const { metadata, projectId } = input;
  const disposables: Disposable[] = [];
  const registeredKinds = new Set<string>();

  const executeCommand = (commandId: string, body: { params?: unknown }) =>
    executeExtensionCommand(projectId, commandId, body).then(unwrapCommandOutcome);

  const findModalView = (resourceKind: string | undefined) =>
    resourceKind
      ? metadata.views.find((view) => view.surface === "modal" && view.resourceKind === resourceKind)
      : undefined;

  for (const record of metadata.dataRenderers ?? []) {
    if (record.resourceKind && !registeredKinds.has(record.resourceKind)) {
      registeredKinds.add(record.resourceKind);
      disposables.push(
        ctx.resources.registerKind({
          kind: record.resourceKind,
          label: resolveLocalizableString(record.title, record.extensionId),
          icon: standardResourceIcons.dataRenderer,
        }),
      );
    }

    const openTicketResource = (resource: ResourceRef | undefined) => {
      if (resource) void ctx.resources.openResource(resource, { replaceActive: true }).catch(() => undefined);
    };

    const modalView = findModalView(record.resourceKind);

    let refreshBoard: () => void = () => {};
    const modal = modalView
      ? createModalController({
          ctx,
          modalView,
          projectId,
          createCommandId: record.createRow?.commandId,
          refresh: () => refreshBoard(),
        })
      : undefined;
    if (modal) disposables.push({ dispose: modal.dispose });

    const { contribution, refresh } = buildExtensionDataRendererContribution({
      record,
      executeCommand,
      onRowClick: (row: DataRendererRow) => {
        // No opener exists for the row's kind until the editor lands; swallow the
        // rejection so the board click is a no-op rather than an error until then.
        openTicketResource(toWorkbenchResource(row.resource, projectId));
      },
      onAfterCreate: (created) => {
        // The create command returns the new row's record; open it so the user can
        // fill in its details immediately.
        const row = created as { id?: string; shorthand?: string; title?: string } | undefined;
        if (!row?.id || !record.resourceKind) return;
        const label = [row.shorthand, row.title].filter(Boolean).join(" ") || row.id;
        openTicketResource(toWorkbenchResource({ type: record.resourceKind, id: row.id, projectId, label }, projectId));
      },
      onCreateRow: modal?.openCreateModal,
    });
    refreshBoard = refresh;

    disposables.push(ctx.renderers.registerDataRenderer(contribution));
    disposables.push(
      ctx.layout.registerWidget(
        {
          id: record.id,
          title: resolveLocalizableString(record.title, record.extensionId),
          area: "main",
          rendererId: record.id,
          singleton: true,
        },
        { priority: 60 },
      ),
    );

    disposables.push(
      registerResourceRoute(ctx, {
        id: `dashboard.extensions.data-renderer.${record.id}`,
        match: (resource) => resource.kind === "dashboard-view" && resource.id === record.id,
        mode: "project",
        widgetId: record.id,
        // Boards predate the project-selection guard; opening one without a project keeps
        // the prior behavior (an empty board in project mode) rather than redirecting.
        requiresProject: false,
        beforeOpen: ({ resource }) => {
          setResourceBreadcrumb(ctx, resource);
          // A board fills the main area and owns no side companions, so drop any
          // panel a resource editor (e.g. the ticket properties sidepanel) left in
          // main-right — the framework only auto-hides it when main is empty.
          ctx.layout.clearArea("main-right");
          if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.projectSidebar)) {
            ctx.renderers.setSelectedNode(dashboardWidgetIds.projectSidebar, resource.uri);
          }
        },
      }),
    );
  }

  return disposables;
};

export const buildExtensionDataRendererSidebarSections = (input: {
  metadata?: DashboardExtensionMetadata;
  projectId?: string;
}): TreeViewSection[] => {
  const { metadata, projectId } = input;
  if (!projectId || !metadata?.dataRenderers?.length) return [];

  return [
    {
      id: "extension-data-renderers",
      nodes: metadata.dataRenderers.map((record) => {
        const resource = createExtensionDataRendererResource(record, projectId);
        return {
          id: resource.uri,
          label: resolveLocalizableString(record.title, record.extensionId),
          icon: resource.icon,
          resource,
        };
      }),
    },
  ];
};
