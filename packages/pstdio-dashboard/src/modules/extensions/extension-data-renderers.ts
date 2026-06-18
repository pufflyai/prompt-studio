import type { DataRendererResourceRef } from "@pstdio/sdk/extensions";
import type { DataRendererRow } from "@pstdio/ui";
import {
  type Disposable,
  type MenuPath,
  type ResourceRef,
  resourceContextMenuPath,
  standardResourceIcons,
  type TreeViewSection,
  type WorkbenchModuleContributionContext,
  type WorkbenchWidgetPlacement,
} from "pstdio-workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { executeExtensionCommand } from "@/shared/extensions/api";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { subscribeToExtensionCommandFeed } from "@/shared/extensions/extension-webview-broadcast";
import {
  buildDashboardExtensionMenuRegistrations,
  type DashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { registerResourceRoute } from "@/shared/workbench/route-helper";
import {
  buildExtensionDataRendererContribution,
  type ExecuteExtensionDataRendererRowActionInput,
  type ExtensionDataRendererRecord,
  unwrapCommandOutcome,
} from "./extension-data-renderer-contributions";
import { createExtensionDataRendererResource, dataRendererResourceKindIcon } from "./extension-data-renderer-resource";
import { dashboardExtensionViewKind, extensionViewWidgetId } from "./extension-view-placement";

type ExtensionViewRecord = DashboardExtensionMetadata["views"][number];

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

type DashboardMenuRegistration = ReturnType<typeof buildDashboardExtensionMenuRegistrations>[number];

const rowResourceUri = (kind: string, id: string) => `dashboard-workbench://${kind}/${id}`;

const sameMenuPath = (left: MenuPath, right: MenuPath) =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

const hasCommandParameters = (params: Record<string, unknown> | undefined) => Object.keys(params ?? {}).length > 0;

const toRowActionResource = (record: ExtensionDataRendererRecord, row: DataRendererRow, projectId: string) =>
  toWorkbenchResource(row.resource, projectId) ??
  (record.resourceKind
    ? ({
        kind: record.resourceKind,
        uri: rowResourceUri(record.resourceKind, row.id),
        id: row.id,
        label: row.title,
        metadata: { projectId },
      } satisfies ResourceRef)
    : undefined);

const findRowActionMenuRegistration = (
  registrations: DashboardMenuRegistration[],
  record: ExtensionDataRendererRecord,
  action: ExecuteExtensionDataRendererRowActionInput["action"],
) => {
  if (!record.resourceKind) return undefined;
  const path = resourceContextMenuPath(record.resourceKind);

  return registrations.find(
    (registration) =>
      registration.contribution.commandId === action.commandId &&
      registration.contextMenuItems.some((item) => sameMenuPath(item.menuPath, path)),
  );
};

const createRowActionRunner =
  (input: {
    ctx: WorkbenchModuleContributionContext;
    menuRegistrations: DashboardMenuRegistration[];
    projectId: string;
    record: ExtensionDataRendererRecord;
  }) =>
  ({ action, row, runDefault }: ExecuteExtensionDataRendererRowActionInput) => {
    const registration = findRowActionMenuRegistration(input.menuRegistrations, input.record, action);
    if (!registration) return runDefault();

    const command = input.ctx.commands.getCommand(registration.command.id);
    if (!command) return runDefault();

    const resource = toRowActionResource(input.record, row, input.projectId);
    const context = resource ? { resource } : undefined;
    const args = { rowId: row.id };
    const label = resolveLocalizableString(action.label, input.record.extensionId);

    if (hasCommandParameters(command.command.params)) {
      input.ctx.commandPalette.requestParams({ record: command, label, args, context });
      return;
    }

    return input.ctx.commands.executeCommand(command.command.id, args, context).then(() => undefined);
  };

const createRowActionRefreshSubscription = (commandIds: Set<string>, refresh: () => void) => ({
  dispose: subscribeToExtensionCommandFeed((event) => {
    if (!event.outcome.ok || !commandIds.has(event.commandId)) return;
    refresh();
  }),
});

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
  const menuRegistrations = buildDashboardExtensionMenuRegistrations(metadata);

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
          icon: dataRendererResourceKindIcon(record),
        }),
      );
    }

    const openResource = (resource: ResourceRef | undefined) => {
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
      executeRowAction: createRowActionRunner({ ctx, menuRegistrations, projectId, record }),
      projectId,
      openResource,
      onRowClick: (row: DataRendererRow) => {
        // No opener exists for the row's kind until the editor lands; swallow the
        // rejection so the board click is a no-op rather than an error until then.
        openResource(toWorkbenchResource(row.resource, projectId));
      },
      onAfterCreate: (created) => {
        // The create command returns the new row's record; open it so the user can
        // fill in its details immediately.
        const row = created as { id?: string; shorthand?: string; title?: string } | undefined;
        if (!row?.id || !record.resourceKind) return;
        const label = [row.shorthand, row.title].filter(Boolean).join(" ") || row.id;
        openResource(toWorkbenchResource({ type: record.resourceKind, id: row.id, projectId, label }, projectId));
      },
      onCreateRow: modal?.openCreateModal,
    });
    refreshBoard = refresh;

    const rowActionCommandIds = new Set((record.rowActions ?? []).map((action) => action.commandId));
    if (rowActionCommandIds.size > 0) {
      disposables.push(createRowActionRefreshSubscription(rowActionCommandIds, () => refreshBoard()));
    }

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
