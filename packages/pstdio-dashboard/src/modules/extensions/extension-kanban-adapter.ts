import { PstdioApiError, PstdioConnectionError } from "@pstdio/sdk/client";
import { type KanbanRendererResourceRef, unwrapCommandOutcome } from "@pstdio/sdk/extensions";
import { UnresolvedSubmissionError } from "@pstdio/ui";
import type { KanbanRendererRow } from "@pstdio/ui/kanban-renderer";
import {
  classifyApiWrite,
  getWorkbenchOperations,
  type MenuPath,
  operationSubject,
  type ResourceRef,
  resourceContextMenuPath,
  standardResourceIcons,
  type WorkbenchModuleContext,
} from "@pstdio/workbench";
import type { WorkbenchExtensionKanbanRendererAdapter } from "@pstdio/workbench/extensions";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { canonicalDashboardResource } from "@/shared/extensions/resource-identity";
import {
  buildDashboardExtensionMenuRegistrations,
  getCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { createDashboardWorkspaces } from "@/shared/workspaces/dashboard-workspaces";
import { createSharedBoardViews } from "./extension-board-views";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";

type KanbanRecord = Parameters<NonNullable<WorkbenchExtensionKanbanRendererAdapter["resolveRowResource"]>>[0];
type MenuRegistration = ReturnType<typeof buildDashboardExtensionMenuRegistrations>["registrations"][number];
export const toDashboardExtensionResource = (
  resource: unknown,
  projectId: string,
  kinds: Parameters<typeof canonicalDashboardResource>[2] = getCachedDashboardExtensionMetadata(
    projectId,
  )?.resourceKinds,
): ResourceRef | undefined => {
  if (!resource || typeof resource !== "object") return undefined;
  const ref = resource as KanbanRendererResourceRef & {
    icon?: string;
  };
  const workspace =
    ref.type === "workspace" ? createDashboardWorkspaces(projectId).find((entry) => entry.id === ref.id) : undefined;
  const resolved = canonicalDashboardResource(ref, projectId, kinds);
  const kind = kinds?.find(
    (kind) => (kind.localId ?? kind.id) === resolved.type && kind.extensionId === resolved.extensionId,
  );
  // Ownership stays on the resource; adding it to metadata would change a file's read key after navigation.
  const metadata =
    ref.metadata || workspace?.resource.metadata
      ? {
          ...ref.metadata,
          ...workspace?.resource.metadata,
          ...(ref.metadata?.resourceParent ? { resourceParent: ref.metadata.resourceParent } : {}),
        }
      : undefined;
  return {
    ...resolved,
    label: workspace?.resource.label ?? ref.label ?? ref.id,
    icon: workspace?.resource.icon ?? ref.icon ?? kind?.icon ?? standardResourceIcons.kanbanRenderer,
    ...(metadata ? { metadata } : {}),
  };
};
const sameMenuPath = (left: MenuPath, right: MenuPath) =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);
const rowResource = (
  record: KanbanRecord,
  row: KanbanRendererRow,
  projectId: string,
  kinds: Parameters<typeof canonicalDashboardResource>[2],
) => {
  const resolved = toDashboardExtensionResource(row.resource, projectId, kinds);
  if (resolved || !record.resourceKind) return resolved;
  return {
    type: record.resourceKind,
    id: row.id,
    extensionId: record.extensionId,
    projectId,
    label: row.title,
  };
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
class AttachmentResultUnconfirmed extends Error {}

const classifyAttachmentWrite = (error: unknown) =>
  error instanceof AttachmentResultUnconfirmed ||
  error instanceof PstdioConnectionError ||
  (error instanceof PstdioApiError && (error.status === 408 || error.status >= 500))
    ? "unknown"
    : classifyApiWrite(error);

const uploadCreatedFile = async (input: {
  extensionInstanceId: string;
  file: File;
  projectId: string;
  resourceId: string;
  signal?: AbortSignal;
  api: ReturnType<typeof getRuntimeApiClient>;
}) => {
  const data = await input.file.arrayBuffer();
  input.signal?.throwIfAborted();
  return input.api.extensions.files.upload(input.projectId, input.extensionInstanceId, {
    name: input.file.name,
    data,
    mimeType: input.file.type || undefined,
    scope: { type: "resource", id: input.resourceId },
  });
};
const attachCreatedFiles = async (input: {
  created: unknown;
  executeCommand: ExecuteDashboardExtensionCommand;
  files: File[];
  projectId: string;
  record: KanbanRecord;
  extensionInstanceId: string | undefined;
  signal?: AbortSignal;
  api: ReturnType<typeof getRuntimeApiClient>;
  saved(file: File): void;
}) => {
  const attachment = input.record.createRow?.attachments;
  const resourceId = (
    input.created as
      | {
          id?: unknown;
        }
      | undefined
  )?.id;
  if (!attachment || input.files.length === 0 || typeof resourceId !== "string") return;
  if (!input.extensionInstanceId) throw new Error(`Extension instance missing: ${input.record.id}`);
  for (const file of input.files) {
    input.signal?.throwIfAborted();
    const ref = await uploadCreatedFile({
      extensionInstanceId: input.extensionInstanceId,
      file,
      projectId: input.projectId,
      resourceId,
      signal: input.signal,
      api: input.api,
    });
    input.signal?.throwIfAborted();
    const attached = await input.executeCommand(
      input.projectId,
      attachment.commandId,
      {
        params: { [attachment.resourceParam]: resourceId, [attachment.fileParam]: ref },
      },
      input.signal,
    );
    if (!attached.outcome.ok && attached.outcome.status !== "rejected")
      throw new AttachmentResultUnconfirmed(attached.outcome.reason);
    unwrapCommandOutcome(attached);
    input.saved(file);
  }
};
export const createDashboardKanbanAdapter = (input: {
  owner?: ReturnType<typeof getRuntimeCollections>;
  ctx: WorkbenchModuleContext;
  executeCommand: ExecuteDashboardExtensionCommand;
  metadata: ResolvedWorkbenchExtensionMetadata;
  projectId: string;
}) => {
  const { ctx, executeCommand, metadata, projectId } = input;
  const owner = input.owner ?? getRuntimeCollections();
  const menuRegistrations = buildDashboardExtensionMenuRegistrations(metadata, (value, extensionId, args) =>
    resolveLocalizableString(value, extensionId, args, owner, projectId),
  ).registrations;
  const adapter: WorkbenchExtensionKanbanRendererAdapter = {
    createViewsProvider: (record) => createSharedBoardViews(projectId, record, metadata),
    resolveRowResource: (_record, row) => toDashboardExtensionResource(row.resource, projectId, metadata.resourceKinds),
    resolveRowActionResource: (record, row) => rowResource(record, row, projectId, metadata.resourceKinds),
    executeRowAction: ({ record, action, row, resource, runDefault }) => {
      const registration = matchingRowAction(menuRegistrations, record, action.commandId);
      const command = registration ? ctx.commands.getCommand(registration.command.id) : undefined;
      if (!command) return runDefault();
      const args = { rowId: row.id };
      const context = resource ? { resource } : undefined;
      const label = resolveLocalizableString(action.label, record.extensionId, undefined, owner, projectId);
      if (Object.keys(command.command.params ?? {}).length > 0) {
        ctx.commandPalette.requestParams({ record: command, label, args, context });
        return;
      }
      return ctx.commands.executeCommand(command.command.id, args, context).then(() => undefined);
    },
    onAfterCreate: async ({ record, created, submission, signal }) => {
      const { files, onAttachmentSaved, onDiscard } = submission;
      const id = (created as { id?: unknown } | undefined)?.id;
      if (!files.length || !record.createRow?.attachments || typeof id !== "string") return;
      signal?.throwIfAborted();
      const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
      const remaining = new Set(files);
      const details = { resourceId: id, filenames: files.map(({ name }) => name) };
      const extensionInstanceId = metadata.extensions.find(
        (extension) => extension.id === record.extensionId,
      )?.extensionInstanceId;
      const api = getRuntimeApiClient(owner);
      // A confirmed create owns a separate attachment recovery. The ticket is never created again.
      let attempt: { id: symbol; result: Promise<void> } | undefined;
      try {
        attempt = operations.submit({
          domain: "resource.attachments",
          projectId,
          subjects: [operationSubject("resource.attachments", projectId, record.extensionId, id)],
          source: record.resourceKind
            ? { type: record.resourceKind, id, projectId, extensionId: record.extensionId }
            : undefined,
          title: "Attach files to the created item",
          draft: details,
          onDiscard,
          classify: classifyAttachmentWrite,
          releaseOnDiscard: true,
          showPending: true,
          describeRecovery: () => "The item was created. Inspect its attachments before adding any files again.",
          write: (attachmentSignal) =>
            attachCreatedFiles({
              created,
              executeCommand,
              files,
              projectId,
              record,
              extensionInstanceId,
              api,
              signal: signal ? AbortSignal.any([signal, attachmentSignal]) : attachmentSignal,
              saved: (file) => {
                remaining.delete(file);
                details.filenames = [...remaining].map(({ name }) => name);
                onAttachmentSaved?.(file);
              },
            }),
        });
        await attempt.result;
      } catch (error) {
        let fallbackRetained = true;
        const attemptId = attempt?.id;
        if (attemptId === undefined) {
          ctx.notifications.show({
            id: `create-attachments.${projectId}.${id}`,
            level: "error",
            title: "Files still need attention",
            message: "The item was created. Its file draft is still available on the board.",
          });
        }
        const retained = () =>
          attemptId === undefined
            ? fallbackRetained
            : operations.getSnapshot().recovery.some((entry) => entry.id === attemptId);
        throw new UnresolvedSubmissionError(
          {
            copyDraft: async () => {
              if (!retained()) throw new Error("The file draft is no longer available.");
              await navigator.clipboard.writeText(JSON.stringify(details));
            },
            dismiss: () => {
              if (attemptId !== undefined) operations.dismiss(attemptId);
            },
            discard: () => {
              if (attemptId === undefined) {
                fallbackRetained = false;
                onDiscard?.();
              } else operations.discard(attemptId);
            },
            isRetained: retained,
          },
          error,
          "The item was created. Some files still need attention.",
        );
      }
    },
  };
  return adapter;
};
