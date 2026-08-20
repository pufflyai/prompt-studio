import type { WorkbenchExtensionKanbanRendererRecord } from "@pstdio/sdk/api";
import type { KanbanRendererResourceRef } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor, KanbanRendererRow } from "@pstdio/ui/kanban-renderer";
import {
  type Disposable,
  type MenuPath,
  type ResourceRef,
  resourceContextMenuPath,
  standardResourceIcons,
  type WorkbenchModuleContext,
} from "@pstdio/workbench";
import {
  registerWorkbenchExtensionKanbanRenderers,
  type WorkbenchExtensionCommandContext,
  type WorkbenchExtensionKanbanRendererAdapter,
} from "@pstdio/workbench/extensions";
import { apiRequest } from "@/lib/api";
import { type CollectionChange, subscribeCollections } from "@/lib/sync/collections";
import { executeExtensionCommand } from "@/shared/extensions/api";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { publishExtensionCommandEvent } from "@/shared/extensions/extension-webview-broadcast";
import {
  buildDashboardExtensionMenuRegistrations,
  type DashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { createWorkspaceBadgeRenderer } from "./extension-workspace-badge-renderer";

type ExtensionKanbanRendererRecord = WorkbenchExtensionKanbanRendererRecord;

const resourceKindIcon = (record: ExtensionKanbanRendererRecord) =>
  record.resourceKind === "ticket" ? "component" : standardResourceIcons.kanbanRenderer;

const isWorkbenchResource = (resource: unknown): resource is ResourceRef =>
  Boolean(resource && typeof resource === "object" && typeof (resource as { kind?: unknown }).kind === "string");

// Rows carry a KanbanRendererResourceRef (type/id) which we lift into a workbench
// ResourceRef so a kind-specific presenter (e.g. the ticket editor) can claim it.
// Idempotent: a row resolved at click time is already a lifted ResourceRef, so it
// passes through untouched rather than being re-lifted off a missing `type`.
export const toWorkbenchResource = (resource: unknown, projectId: string): ResourceRef | undefined => {
  if (!resource || typeof resource !== "object") return undefined;
  if (isWorkbenchResource(resource)) return resource;
  const ref = resource as KanbanRendererResourceRef & { icon?: string };
  return {
    kind: ref.type,
    uri: `dashboard-workbench://${ref.type}/${ref.id}`,
    id: ref.id,
    label: ref.label ?? ref.id,
    icon: ref.icon ?? standardResourceIcons.kanbanRenderer,
    metadata: { ...ref.metadata, projectId: ref.projectId ?? projectId },
  };
};

type DashboardMenuRegistration = ReturnType<typeof buildDashboardExtensionMenuRegistrations>[number];

const rowResourceUri = (kind: string, id: string) => `dashboard-workbench://${kind}/${id}`;

const sameMenuPath = (left: MenuPath, right: MenuPath) =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

const hasCommandParameters = (params: Record<string, unknown> | undefined) => Object.keys(params ?? {}).length > 0;

const synthesizeRowResource = (
  record: ExtensionKanbanRendererRecord,
  row: KanbanRendererRow,
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
  record: ExtensionKanbanRendererRecord,
  created: unknown,
  projectId: string,
): ResourceRef | undefined => {
  const row = created as { id?: string; resource?: unknown; shorthand?: string; title?: string } | undefined;
  const resource = toWorkbenchResource(row?.resource, projectId);
  if (resource) return resource;
  if (!row?.id || !record.resourceKind) return undefined;
  const label = [row.shorthand, row.title].filter(Boolean).join(" ") || row.id;
  return toWorkbenchResource({ type: record.resourceKind, id: row.id, projectId, label }, projectId);
};

const findRowActionMenuRegistration = (
  registrations: DashboardMenuRegistration[],
  record: ExtensionKanbanRendererRecord,
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

const sessionSyncTables = new Set<CollectionChange["table"]>(["sessions", "workspace_sessions"]);

// Session status shown on a row (e.g. a ticket's workspace badge) changes outside planner
// commands — a run finishing, an agent asking for input — so follow the synced feed directly.
const createSessionSyncRefreshSubscription = (refresh: () => void) => ({
  dispose: subscribeCollections((change) => {
    if (change && sessionSyncTables.has(change.table)) refresh();
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
  record: ExtensionKanbanRendererRecord;
  uploadFile: typeof uploadExtensionFile;
}) => {
  const { created, executeCommand, files, projectId, record, uploadFile } = input;
  const attachment = record.createRow?.attachments;
  const resourceId = (created as { id?: unknown } | undefined)?.id;
  if (!attachment || files.length === 0 || typeof resourceId !== "string") return;
  if (!record.extensionInstanceId) throw new Error(`Extension instance missing for kanban renderer: ${record.id}`);

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

export const registerExtensionKanbanRenderers = (
  ctx: WorkbenchModuleContext,
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

  const refreshRecord = (record: ExtensionKanbanRendererRecord) => {
    if (ctx.renderers.getKanbanRenderer(record.id)) ctx.renderers.refreshKanbanRenderer(record.id);
  };

  for (const record of metadata.kanbanRenderers ?? []) {
    // A declared resource kind owns its registration; a renderer only fills in a kind
    // nothing has registered yet (a board whose rows are not a composition resource).
    if (
      record.resourceKind &&
      !registeredKinds.has(record.resourceKind) &&
      !ctx.resources.getKind(record.resourceKind)
    ) {
      registeredKinds.add(record.resourceKind);
      disposables.push(
        ctx.resources.registerKind({
          kind: record.resourceKind,
          label: resolveLocalizableString(record.title, record.extensionId),
          icon: resourceKindIcon(record),
        }),
      );
    }
  }

  disposables.push(
    createSessionSyncRefreshSubscription(() => {
      for (const record of metadata.kanbanRenderers ?? []) refreshRecord(record);
    }),
  );

  const commandContext: WorkbenchExtensionCommandContext = {
    executeCommand: async (commandId, body) => {
      const response = await executeCommand(projectId, commandId, body);
      publishExtensionCommandEvent(response);
      return response;
    },
    projectId,
    workbench: ctx,
  };

  const adapter: WorkbenchExtensionKanbanRendererAdapter = {
    decorateAttribute: (_, attribute) => decorateAttribute({ attribute, openResource, projectId }),
    resolveRowResource: (_, row) => toWorkbenchResource(row.resource, projectId),
    resolveRowActionResource: (record, row) => synthesizeRowResource(record, row, projectId),
    resolveNavigationResource: (_, resource) => toWorkbenchResource(resource, projectId)!,
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
  };

  disposables.push(
    registerWorkbenchExtensionKanbanRenderers(
      commandContext,
      metadata.kanbanRenderers ?? [],
      adapter,
      metadata.panels,
      metadata.resourcePanels,
    ),
  );

  return disposables;
};
