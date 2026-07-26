import type { WorkbenchExtensionDataRendererRecord } from "@pstdio/sdk/api";
import type { DataRendererResourceRef } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor, DataRendererRow } from "@pstdio/ui/data-renderer";
import {
  type Disposable,
  type MenuPath,
  type ResourceRef,
  resourceContextMenuPath,
  standardResourceIcons,
  type TreeNode,
  type WorkbenchModuleContributionContext,
} from "@pstdio/workbench/core";
import {
  registerWorkbenchExtensionDataRenderers,
  type WorkbenchExtensionCommandContext,
  type WorkbenchExtensionDataRendererAdapter,
} from "@pstdio/workbench/extensions";
import { apiRequest } from "@/lib/api";
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
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { createExtensionDataRendererResource, dataRendererResourceKindIcon } from "./extension-data-renderer-resource";
import { createWorkspaceBadgeRenderer } from "./extension-workspace-badge-renderer";

type ExtensionDataRendererRecord = WorkbenchExtensionDataRendererRecord;

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
      registration.menuItems.some((item) => sameMenuPath(item.menuPath, path)),
  );
};

const createRowActionRefreshSubscription = (commandIds: Set<string>, refresh: () => void) => ({
  dispose: subscribeToExtensionCommandFeed((event) => {
    if (!event.outcome.ok || !commandIds.has(event.commandId)) return;
    refresh();
  }),
});

const uploadExtensionFile = async (input: {
  extensionInstanceId: string;
  file: File;
  projectId: string;
  resourceId: string;
}) => {
  const { extensionInstanceId, file, projectId, resourceId } = input;
  const query = new URLSearchParams({ scope_type: "resource", scope_id: resourceId });
  return apiRequest<Record<string, unknown>>(
    `/v1/projects/${encodeURIComponent(projectId)}/extensions/${encodeURIComponent(extensionInstanceId)}/files?${query.toString()}`,
    {
      method: "POST",
      body: await file.arrayBuffer(),
      headers: {
        "content-type": file.type || "application/octet-stream",
        "x-file-name": encodeURIComponent(file.name),
      },
    },
  );
};

const attachCreatedFiles = async (input: {
  created: unknown;
  executeCommand: ExecuteDashboardExtensionCommand;
  files: File[];
  projectId: string;
  record: ExtensionDataRendererRecord;
  uploadFile: typeof uploadExtensionFile;
}) => {
  const { created, executeCommand, files, projectId, record, uploadFile } = input;
  const attachment = record.createRow?.attachments;
  const resourceId = (created as { id?: unknown } | undefined)?.id;
  if (!attachment || files.length === 0 || typeof resourceId !== "string") return;
  if (!record.extensionInstanceId) throw new Error(`Extension instance missing for data renderer: ${record.id}`);

  for (const file of files) {
    const ref = await uploadFile({
      extensionInstanceId: record.extensionInstanceId,
      file,
      projectId,
      resourceId,
    });
    await executeCommand(projectId, attachment.commandId, {
      params: {
        [attachment.resourceParam]: resourceId,
        [attachment.fileParam]: ref,
      },
    });
  }
};

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

export const registerExtensionDataRenderers = (
  ctx: WorkbenchModuleContributionContext,
  input: {
    metadata: DashboardExtensionMetadata;
    projectId: string;
    executeCommand?: ExecuteDashboardExtensionCommand;
    uploadFile?: typeof uploadExtensionFile;
  },
) => {
  const { metadata, projectId } = input;
  const executeCommand = input.executeCommand ?? executeExtensionCommand;
  const uploadFile = input.uploadFile ?? uploadExtensionFile;
  const disposables: Disposable[] = [];
  const registeredKinds = new Set<string>();
  const menuRegistrations = buildDashboardExtensionMenuRegistrations(metadata);

  const openResource = (resource: ResourceRef | undefined) => {
    if (resource) void ctx.resources.openResource(resource, { replaceActive: true }).catch(() => undefined);
  };

  const refreshRecord = (record: ExtensionDataRendererRecord) => {
    if (ctx.renderers.getDataRenderer(record.id)) ctx.renderers.refreshDataRenderer(record.id);
  };

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
          if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
            ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, resource.uri);
          }
        },
      }),
    );
  }

  const commandContext: WorkbenchExtensionCommandContext = {
    executeCommand: (commandId, body) => executeCommand(projectId, commandId, body),
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
    onAfterCreate: async ({ record, created, submission }) => {
      // The resource already exists by now. Letting an upload/attach failure
      // reject would keep the create dialog open reporting failure, and a retry
      // would create a duplicate — so surface it and still open what was made.
      try {
        await attachCreatedFiles({ created, executeCommand, files: submission.files, projectId, record, uploadFile });
      } catch (error) {
        ctx.notifications.show({
          level: "error",
          title: "Could not attach files",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      openResource(synthesizeCreatedResource(record, created, projectId));
    },
    onAfterMutation: (record) => refreshRecord(record),
  };

  disposables.push(registerWorkbenchExtensionDataRenderers(commandContext, metadata.dataRenderers ?? [], adapter));

  return disposables;
};

export const buildExtensionDataRendererSidenavHeaderNodes = (input: {
  metadata?: DashboardExtensionMetadata;
  projectId?: string;
}): TreeNode[] => {
  const { metadata, projectId } = input;
  if (!projectId || !metadata?.dataRenderers?.length) return [];

  return metadata.dataRenderers.map((record) => {
    const resource = createExtensionDataRendererResource(record, projectId);
    return {
      id: resource.uri,
      label: resolveLocalizableString(record.title, record.extensionId),
      icon: resource.icon,
      canHide: true,
      resource,
    };
  });
};
