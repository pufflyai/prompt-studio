import { createHash } from "node:crypto";
import {
  activityAttachmentSchema,
  publishResourceActivitySchema,
  type ResourceActivityAttachment,
  type ResourceActivityImport,
} from "pstdio-api-contracts";
import {
  type ActivityAuthor,
  type ResourceActivityApi,
  type ResourceRef,
  resourceKey,
} from "pstdio-api-contracts/extension-kernel";
import { initialRecordRevision } from "pstdio-sync/records";
import { createRecordAssets } from "../extensions/command-environment/record-assets";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { type ActivityOperation, resourceActivityAccess, runActivityOwnerCommand } from "./resource-activity-access";
import { handoffResourceActivity } from "./resource-activity-handoff";
import { createResourceActivityStore, resourceActivityOwnerId } from "./resource-activity-store";

export const createResourceActivityApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId?: string; sessionId?: string },
) => {
  const operations = { comment: "comment", change: "change", implementation: "outcome", review: "outcome" } as const;
  const bodyOwner = { workbenchId: input.projectId, extensionId: resourceActivityOwnerId };
  const store = createResourceActivityStore(deps.extensionStorageService, input.projectId, {
    assets: createRecordAssets(deps.assetTransferService, bodyOwner),
    stage: (id, body) => deps.assetTransferService.stage(bodyOwner, id, new Blob([body], { type: "text/markdown" })),
    read: async (asset) => new Response(await deps.assetTransferService.read(bodyOwner, asset)).text(),
  });
  const requireAccess = async (ref: ResourceRef, operation: ActivityOperation) => {
    const access = await resourceActivityAccess(deps, input, ref, operation);
    if (!access) throw new Error("Activity is not enabled on this resource.");
    return access;
  };
  const author = async (sessionId?: string) => {
    if (sessionId) {
      const session = await deps.sessionService.get(sessionId);
      if (!session || session.project_id !== input.projectId)
        throw new Error("Source session belongs to another project or is unavailable.");
      return {
        type: "agent",
        id: session.id,
        name: session.title || "Agent",
        extensionId: input.extensionId,
      } satisfies ActivityAuthor;
    }
    if (input.extensionId)
      return {
        type: "system",
        id: input.extensionId,
        name: input.extensionId,
        extensionId: input.extensionId,
      } satisfies ActivityAuthor;
    const status = await deps.accountService.status();
    const environment = await deps.environmentService.get();
    return {
      type: "user",
      id: status.login?.accountId ?? `device:${environment.environmentId}`,
      name: status.login?.email ?? "Local user",
    } satisfies ActivityAuthor;
  };
  const changed = (resource: ResourceRef) =>
    deps.eventBus.emit("resource_activity", "set", { id: crypto.randomUUID(), resource });
  return {
    importEntry: async (resource: ResourceRef, imported: ResourceActivityImport) => {
      const access = await requireAccess(resource, "outcome");
      if (input.extensionId !== access.resource.extensionId)
        throw new Error("Only the resource owner can import historical Activity.");
      if (imported.source.projectId !== input.projectId || !imported.source.extensionId)
        throw new Error("Historical Activity requires a source in the same project.");
      if (!Number.isFinite(Date.parse(imported.createdAt)))
        throw new Error("Historical Activity requires its original timestamp.");
      const entry = await store.append(access.resource, imported.entry, imported.author, {
        createdAt: imported.createdAt,
        source: imported.source,
      });
      changed(access.resource);
      return entry;
    },
    capabilities: async (resource) => {
      const access = await resourceActivityAccess(deps, input, resource, "read");
      if (!access) return null;
      if (!access.capabilities.comments || !access.declaration?.authorizeActivity) return access.capabilities;
      const permission = (await runActivityOwnerCommand(deps, access.resource, access.declaration.authorizeActivity, {
        operation: "comment",
        resource: access.resource,
      })) as { allowed?: boolean };
      return { ...access.capabilities, comments: permission.allowed === true };
    },
    query: async ({ resource, ...query }) => store.query((await requireAccess(resource, "read")).resource, query),
    get: async (resource, id) => {
      try {
        return await store.get((await requireAccess(resource, "read")).resource, id);
      } catch (error) {
        // The original source owner retains access to migrated evidence after the target is removed.
        if (!input.extensionId || resource.projectId !== input.projectId || !resource.extensionId) throw error;
        const entry = await store.get(resource, id);
        if (
          entry.origin?.resource.projectId !== input.projectId ||
          entry.origin.resource.extensionId !== input.extensionId
        )
          throw error;
        return entry;
      }
    },
    publish: async (resource, raw) => {
      const body = publishResourceActivitySchema.parse(raw);
      const access = await requireAccess(resource, operations[body.kind]);
      if (body.revision) {
        const workspace = await deps.workspaceService.get(body.revision.workspaceId);
        const link = await deps.workspaceSessionService.getWorkspaceBySessionId(body.revision.sessionId);
        if (!workspace || workspace.project_id !== input.projectId || link?.id !== workspace.id)
          throw new Error("Outcome session and workspace do not match this project.");
        if (input.sessionId && body.revision.sessionId !== input.sessionId)
          throw new Error("Outcome does not belong to the invoking session.");
      }
      const environment = body.target ? await deps.environmentService.get() : undefined;
      const entry = await store.append(
        access.resource,
        body,
        await author(body.revision?.sessionId ?? input.sessionId),
        environment ? { handoffDeviceId: environment.environmentId } : undefined,
      );
      changed(access.resource);
      return entry;
    },
    resolve: async (resource, id, resolved) => {
      const access = await requireAccess(resource, "resolve");
      const entry = await store.resolve(access.resource, id, resolved);
      changed(access.resource);
      return entry;
    },
    attach: async (resource, file) => {
      const access = await requireAccess(resource, "attach");
      if (!file.name.trim() || !file.mimeType) throw new Error("Attachment requires a name and media type.");
      const owner = store.owner;
      const sha256 = createHash("sha256").update(file.data).digest("hex");
      const fingerprint = JSON.stringify([
        resourceKey(access.resource),
        file.key ?? crypto.randomUUID(),
        file.name,
        file.mimeType,
        sha256,
      ]);
      const id = createHash("sha256").update(fingerprint).digest("hex");
      const receiptId = file.key
        ? `attachment-key/${createHash("sha256")
            .update(JSON.stringify([resourceKey(access.resource), file.key]))
            .digest("hex")}`
        : undefined;
      const blob = new Blob([new Uint8Array(file.data)], { type: file.mimeType });
      const asset = await deps.assetTransferService.stage(owner, id, blob);
      const attachment = activityAttachmentSchema.parse({
        id,
        name: file.name,
        mimeType: file.mimeType,
        size: blob.size,
        sha256,
      });
      const opened = await deps.extensionStorageService.open({
        owner,
        assets: createRecordAssets(deps.assetTransferService, owner),
      });
      await opened.records.transaction(async (locked) => {
        if (receiptId) {
          const receipt = await locked.read(receiptId);
          if (receipt.exists && (receipt.value as { id: string }).id !== id)
            throw new Error("Attachment key was reused with changed content.");
        }
        const current = await locked.read(`attachment/${id}`);
        if (current.exists) return;
        await locked.commit({
          operationId: crypto.randomUUID(),
          edits: [
            {
              recordId: `attachment/${id}`,
              expectedRevision: initialRecordRevision(),
              replace: { scope: resourceKey(access.resource), attachment },
              asset,
              deleted: false,
            },
            ...(receiptId
              ? [{ recordId: receiptId, expectedRevision: initialRecordRevision(), replace: { id }, deleted: false }]
              : []),
          ],
        });
      });
      return attachment;
    },
    readAttachment: async (resource, id) => {
      let scope: string;
      try {
        scope = resourceKey((await requireAccess(resource, "read")).resource);
      } catch (error) {
        if (
          !input.extensionId ||
          resource.projectId !== input.projectId ||
          !resource.extensionId ||
          !(await store.hasImportedAttachment(resource, id, input.extensionId))
        )
          throw error;
        scope = resourceKey(resource);
      }
      const record = await (await store.records()).read(`attachment/${id}`);
      const value = record.value as { scope?: string; attachment?: ResourceActivityAttachment };
      if (!record.exists || record.deleted || value?.scope !== scope || !record.asset)
        throw new Error("Attachment not found on this resource.");
      if (record.asset.sha256 !== value.attachment?.sha256 || record.asset.byteLength !== value.attachment.size)
        throw new Error("Activity attachment integrity mismatch.");
      const blob = await deps.assetTransferService.read(store.owner, record.asset);
      return {
        attachment: activityAttachmentSchema.parse(value.attachment),
        data: new Uint8Array(await new Response(blob).arrayBuffer()),
      };
    },
    handoff: async (resource, id, options = {}) => {
      const access = await requireAccess(resource, "handoff");
      try {
        return await handoffResourceActivity(deps, store, access, id, options);
      } finally {
        changed(access.resource);
      }
    },
  } satisfies ResourceActivityApi & {
    importEntry(
      resource: ResourceRef,
      input: ResourceActivityImport,
    ): Promise<import("pstdio-api-contracts").ResourceActivityEntry>;
  };
};
