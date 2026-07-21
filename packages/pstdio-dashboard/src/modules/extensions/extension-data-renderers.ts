import type { WorkbenchExtensionDataRendererRecord } from "@pstdio/sdk/api";
import type { DataRendererResourceRef } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor, DataRendererRow } from "@pstdio/ui/data-renderer";
import {
  type Disposable,
  type MenuPath,
  type ResourceRef,
  resourceContextMenuPath,
  standardResourceIcons,
  type TreeViewSection,
  type WorkbenchModuleContributionContext,
  type WorkbenchWidgetPlacement,
} from "@pstdio/workbench/core";
import {
  registerWorkbenchExtensionDataRenderers,
  type WorkbenchExtensionCommandContext,
  type WorkbenchExtensionDataRendererAdapter,
} from "@pstdio/workbench/extensions";
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
import { createExtensionDataRendererResource, dataRendererResourceKindIcon } from "./extension-data-renderer-resource";
import { dashboardExtensionViewKind, extensionViewWidgetId } from "./extension-view-placement";
import { createWorkspaceBadgeRenderer } from "./extension-workspace-badge-renderer";

type ExtensionDataRendererRecord = WorkbenchExtensionDataRendererRecord;
type ExtensionViewRecord = DashboardExtensionMetadata["views"][number];

const isWorkbenchResource = (resource: unknown): resource is ResourceRef =>
  Boolean(resource && typeof resource === "object" && typeof (resource as { kind?: unknown }).kind === "string");

// Rows carry a DataRendererResourceRef (type/id) which we lift into a workbench
// ResourceRef so a kind-specific opener (e.g. the ticket editor) can claim it.
// Idempotent: a row resolved at click time is already a lifted ResourceRef, so it
// passes through untouched rather than being re-lifted off a missing `type`.
const toWorkbenchResource = (resource: unknown, projectId: string): ResourceRef | undefined => {
  if (!resource || typeof resource !== "object") return undefined;
  if (isWorkbenchResource(resource)) return resource;
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

const synthesizeRowResource = (
  record: ExtensionDataRendererRecord,
  row: DataRendererRow,
  projectId: string,
): ResourceRef | undefined => {
  const fromRow = toWorkbenchResource(row.resource, projectId);
  if (fromRow) return fromRow;
  if (!record.resourceKind) return undefined;
  return {
    kind: record.resourceKind,
    uri: rowResourceUri(record.resourceKind, row.id),
    id: row.id,
    label: row.title,
    metadata: { projectId },
  };
};

const synthesizeCreatedResource = (
  record: ExtensionDataRendererRecord,
  created: unknown,
  projectId: string,
): ResourceRef | undefined => {
  const row = created as { id?: string; shorthand?: string; title?: string } | undefined;
  if (!row?.id || !record.resourceKind) return undefined;
  const label = [row.shorthand, row.title].filter(Boolean).join(" ") || row.id;
  return toWorkbenchResource({ type: record.resourceKind, id: row.id, projectId, label }, projectId);
};

const findRowActionMenuRegistration = (
  registrations: DashboardMenuRegistration[],
  record: ExtensionDataRendererRecord,
  commandId: string,
) => {
  if (!record.resourceKind) return undefined;
  const path = resourceContextMenuPath(record.resourceKind);

  return registrations.find(
    (registration) =>
      registration.contribution.commandId === commandId &&
      registration.contextMenuItems.some((item) => sameMenuPath(item.menuPath, path)),
  );
};

const createRowActionRefreshSubscription = (commandIds: Set<string>, refresh: () => void) => ({
  dispose: subscribeToExtensionCommandFeed((event) => {
    if (!event.outcome.ok || !commandIds.has(event.commandId)) return;
    refresh();
  }),
});

// Attribute decoration: attributes that opt in to the workspace-badge display get a host renderer.
const decorateAttribute = (input: {
  attribute: AttributeDescriptor;
  openResource: (resource: ResourceRef) => void;
  projectId: string;
}): AttributeDescriptor => {
  const { attribute, openResource, projectId } = input;
  if (attribute.display?.kind !== "workspace-badge") return attribute;
  return {
    ...attribute,
    render: createWorkspaceBadgeRenderer({
      itemsAttributeId: attribute.display.itemsAttributeId,
      openResource,
      projectId,
    }),
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
  onCreated: (created: unknown) => void;
  refresh: () => void;
}) => {
  const { ctx, modalView, projectId, createCommandId, onCreated, refresh } = input;
  const widgetId = extensionViewWidgetId(modalView.id);
  let activePlacement: WorkbenchWidgetPlacement | undefined;

  const close = () => {
    const placement = activePlacement;
    activePlacement = undefined;
    if (placement) ctx.layout.removeWidgetPlacement(placement.widgetId);
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
        onCreated(event.outcome.value);
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

  const findModalView = (resourceKind: string | undefined) =>
    resourceKind
      ? metadata.views.find((view) => view.role === "modal" && view.resourceKind === resourceKind)
      : undefined;

  const openResource = (resource: ResourceRef | undefined) => {
    if (resource) void ctx.resources.openResource(resource, { replaceActive: true }).catch(() => undefined);
  };

  const refreshRecord = (record: ExtensionDataRendererRecord) => {
    if (ctx.renderers.getDataRenderer(record.id)) ctx.renderers.refreshDataRenderer(record.id);
  };

  // Per-record modal controllers; built up while iterating dataRenderers and consulted by the adapter.
  const modalControllers = new Map<string, ReturnType<typeof createModalController>>();

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

    const modalView = findModalView(record.resourceKind);
    const modal = modalView
      ? createModalController({
          ctx,
          modalView,
          projectId,
          createCommandId: record.createRow?.commandId,
          onCreated: (created) => openResource(synthesizeCreatedResource(record, created, projectId)),
          refresh: () => refreshRecord(record),
        })
      : undefined;
    if (modal) {
      modalControllers.set(record.id, modal);
      disposables.push({ dispose: modal.dispose });
    }

    const rowActionCommandIds = new Set((record.rowActions ?? []).map((action) => action.commandId));
    if (rowActionCommandIds.size > 0) {
      disposables.push(createRowActionRefreshSubscription(rowActionCommandIds, () => refreshRecord(record)));
    }

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
          // A board fills the main region and owns no side companions, so drop any
          // panel a resource editor (e.g. the ticket properties sidepanel) left in
          // main-right — the framework only auto-hides it when main is empty.
          ctx.layout.clearRegion("main-right-menu");
          if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) {
            ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidebar, resource.uri);
          }
        },
      }),
    );
  }

  const commandContext: WorkbenchExtensionCommandContext = {
    executeCommand: (commandId, body) => executeExtensionCommand(projectId, commandId, body),
    projectId,
    workbench: ctx,
  };

  const adapter: WorkbenchExtensionDataRendererAdapter = {
    decorateAttribute: (_, attribute) => decorateAttribute({ attribute, openResource, projectId }),
    resolveRowResource: (_, row) => toWorkbenchResource(row.resource, projectId),
    resolveRowActionResource: (record, row) => synthesizeRowResource(record, row, projectId),
    onRowClick: ({ resource }) => openResource(resource),
    executeRowAction: ({ record, action, row, resource, runDefault }) => {
      const registration = findRowActionMenuRegistration(menuRegistrations, record, action.commandId);
      if (!registration) return runDefault();

      const command = ctx.commands.getCommand(registration.command.id);
      if (!command) return runDefault();

      const args = { rowId: row.id };
      const context = resource ? { resource } : undefined;
      const label = resolveLocalizableString(action.label, record.extensionId);

      if (hasCommandParameters(command.command.params)) {
        ctx.commandPalette.requestParams({ record: command, label, args, context });
        return;
      }

      return ctx.commands.executeCommand(command.command.id, args, context).then(() => undefined);
    },
    onCreateRow: ({ record, columnId, executeDefault }) => {
      const modal = modalControllers.get(record.id);
      if (modal) modal.openCreateModal(columnId);
      else void executeDefault();
    },
    onAfterCreate: ({ record, created }) => {
      openResource(synthesizeCreatedResource(record, created, projectId));
    },
    onAfterMutation: (record) => refreshRecord(record),
  };

  disposables.push(registerWorkbenchExtensionDataRenderers(commandContext, metadata.dataRenderers ?? [], adapter));

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
          // A board (e.g. Tickets) is a top-level nav entry — opt it into the sidebar's hide/show menu.
          canHide: true,
          resource,
        };
      }),
    },
  ];
};
