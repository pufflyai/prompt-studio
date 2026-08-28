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
import type { WorkbenchExtensionKanbanRendererAdapter } from "@pstdio/workbench/extensions";
import { apiRequest } from "@/lib/api";
import { type CollectionChange, subscribeCollections } from "@/lib/sync/collections";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { buildDashboardExtensionMenuRegistrations } from "@/shared/extensions/workbench-extension-contributions";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { createBadgeListRenderer } from "./extension-workspace-badge-renderer";

type KanbanRecord = Parameters<NonNullable<WorkbenchExtensionKanbanRendererAdapter["resolveRowResource"]>>[0];
type MenuRegistration = ReturnType<typeof buildDashboardExtensionMenuRegistrations>["registrations"][number];

const isWorkbenchResource = (resource: unknown): resource is ResourceRef =>
  Boolean(resource && typeof resource === "object" && typeof (resource as { kind?: unknown }).kind === "string");

const hasOnlyWorkspaceBadgeResources = (value: unknown) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const resource = (item as { resource?: unknown }).resource;
    return Boolean(resource && typeof resource === "object" && (resource as { type?: unknown }).type === "workspace");
  });

export const toDashboardExtensionResource = (resource: unknown, projectId: string): ResourceRef | undefined => {
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

const sameMenuPath = (left: MenuPath, right: MenuPath) =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

const rowResource = (record: KanbanRecord, row: KanbanRendererRow, projectId: string) => {
  const resolved = toDashboardExtensionResource(row.resource, projectId);
  if (resolved || !record.resourceKind) return resolved;
  return {
    kind: record.resourceKind,
    uri: `dashboard-workbench://${record.resourceKind}/${row.id}`,
    id: row.id,
    label: row.title,
    metadata: { projectId },
  };
};

const createdResource = (record: KanbanRecord, value: unknown, projectId: string) => {
  const created = value as { id?: string; resource?: unknown; shorthand?: string; title?: string } | undefined;
  const resolved = toDashboardExtensionResource(created?.resource, projectId);
  if (resolved || !created?.id || !record.resourceKind) return resolved;
  const label = [created.shorthand, created.title].filter(Boolean).join(" ") || created.id;
  return toDashboardExtensionResource({ type: record.resourceKind, id: created.id, label }, projectId);
};

const matchingRowAction = (registrations: MenuRegistration[], record: KanbanRecord, commandId: string) => {
  if (!record.resourceKind) return undefined;
  const path = resourceContextMenuPath(record.resourceKind);
  return registrations.find(
    (registration) =>
      registration.contribution.commandId === commandId &&
      registration.menuItems.some((item) => sameMenuPath(item.menuPath, path)),
  );
};

const decorateAttribute = (
  ctx: WorkbenchModuleContext,
  projectId: string,
  attribute: AttributeDescriptor,
): AttributeDescriptor => {
  if (attribute.display?.kind !== "badge-list") return attribute;
  const genericRender = attribute.render;
  const itemsAttributeId = attribute.display.itemsAttributeId;
  const workspaceRender = createBadgeListRenderer({
    itemsAttributeId,
    projectId,
    openResource: (resource) => void ctx.resources.openResource(resource, { replaceActive: true }),
  });
  return {
    ...attribute,
    render: (value, row) => {
      const items = row.attributes[itemsAttributeId];
      return hasOnlyWorkspaceBadgeResources(items)
        ? workspaceRender(value, row)
        : (genericRender?.(value, row) ?? null);
    },
  };
};

const uploadCreatedFile = async (input: {
  extensionInstanceId: string;
  file: File;
  projectId: string;
  resourceId: string;
}) => {
  const query = new URLSearchParams({ scope_type: "resource", scope_id: input.resourceId });
  return apiRequest<Record<string, unknown>>(
    `/v1/projects/${encodeURIComponent(input.projectId)}/extensions/${encodeURIComponent(input.extensionInstanceId)}/files?${query.toString()}`,
    {
      method: "POST",
      body: await input.file.arrayBuffer(),
      headers: {
        "content-type": input.file.type || "application/octet-stream",
        "x-file-name": encodeURIComponent(input.file.name),
      },
    },
  );
};

const attachCreatedFiles = async (input: {
  created: unknown;
  executeCommand: ExecuteDashboardExtensionCommand;
  files: File[];
  projectId: string;
  record: KanbanRecord;
}) => {
  const attachment = input.record.createRow?.attachments;
  const resourceId = (input.created as { id?: unknown } | undefined)?.id;
  if (!attachment || input.files.length === 0 || typeof resourceId !== "string") return;
  if (!input.record.extensionInstanceId) throw new Error(`Extension instance missing: ${input.record.id}`);

  for (const file of input.files) {
    const ref = await uploadCreatedFile({
      extensionInstanceId: input.record.extensionInstanceId,
      file,
      projectId: input.projectId,
      resourceId,
    });
    await input.executeCommand(input.projectId, attachment.commandId, {
      params: { [attachment.resourceParam]: resourceId, [attachment.fileParam]: ref },
    });
  }
};

export const createDashboardKanbanAdapter = (input: {
  ctx: WorkbenchModuleContext;
  executeCommand: ExecuteDashboardExtensionCommand;
  metadata: ResolvedWorkbenchExtensionMetadata;
  projectId: string;
}) => {
  const { ctx, executeCommand, metadata, projectId } = input;
  const menuRegistrations = buildDashboardExtensionMenuRegistrations(metadata).registrations;
  const adapter: WorkbenchExtensionKanbanRendererAdapter = {
    decorateAttribute: (_record, attribute) => decorateAttribute(ctx, projectId, attribute),
    resolveRowResource: (_record, row) => toDashboardExtensionResource(row.resource, projectId),
    resolveRowActionResource: (record, row) => rowResource(record, row, projectId),
    resolveNavigationResource: (_record, resource) => toDashboardExtensionResource(resource, projectId)!,
    executeRowAction: ({ record, action, row, resource, runDefault }) => {
      const registration = matchingRowAction(menuRegistrations, record, action.commandId);
      const command = registration ? ctx.commands.getCommand(registration.command.id) : undefined;
      if (!command) return runDefault();
      const args = { rowId: row.id };
      const context = resource ? { resource } : undefined;
      const label = resolveLocalizableString(action.label, record.extensionId);
      if (Object.keys(command.command.params ?? {}).length > 0) {
        ctx.commandPalette.requestParams({ record: command, label, args, context });
        return;
      }
      return ctx.commands.executeCommand(command.command.id, args, context).then(() => undefined);
    },
    onAfterCreate: async ({ record, created, submission }) => {
      try {
        await attachCreatedFiles({ created, executeCommand, files: submission.files, projectId, record });
      } catch (error) {
        ctx.notifications.show({
          level: "error",
          title: "Could not attach files",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      const resource = createdResource(record, created, projectId);
      if (resource) void ctx.resources.openResource(resource, { replaceActive: true }).catch(() => undefined);
    },
  };

  const rendererIds = metadata.views.filter((view) => view.body.kind === "kanban").map((view) => view.id);
  const sessionTables = new Set<CollectionChange["table"]>(["sessions", "workspace_sessions"]);
  const disposable: Disposable = {
    dispose: subscribeCollections((change) => {
      if (!change || !sessionTables.has(change.table)) return;
      for (const rendererId of rendererIds) {
        if (ctx.renderers.getKanbanRenderer(rendererId)) ctx.renderers.refreshKanbanRenderer(rendererId);
      }
    }),
  };

  return { adapter, disposable };
};
