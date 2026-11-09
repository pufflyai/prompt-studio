import { createStorageId, createStorageMigration } from "pstdio-api-contracts";
import { type CommandRunnerEnvironment, createReadBoundary, type InvocationScope } from "pstdio-extensions";
import { apiLogger } from "../../../lib/logger";
import type { ExtensionsRouteDeps } from "../deps";
import { createPublicationStorageAccess, guardPublicationStorage } from "../publication/storage-access";
import { createExtensionAssetsApi } from "./assets";
import { createExtensionBlobsApi } from "./blobs";
import { createExtensionLogApi } from "./logs";
import { createExtensionRecordsApi } from "./records";

type StorageApiInput = {
  extensionId: string;
  extensionInstanceId: string;
  projectId: string;
  source?: { version: string | null; source_ref: string | null; source_path: string };
  signal?: AbortSignal;
  scope?: InvocationScope;
  scopeType?: string;
  scopeId?: string;
};

type RuntimeStorageScope = Parameters<CommandRunnerEnvironment["storage"]["scope"]>[0];

const resolveStorageScopeInput = (input: StorageApiInput, nextScope: RuntimeStorageScope) => {
  if (nextScope.type === "project") return { ...input, scopeType: undefined, scopeId: undefined };
  if (nextScope.type === "resource") {
    const resource = "resource" in nextScope ? nextScope.resource : undefined;
    if (!resource?.id) throw new Error("resource storage scope requires resource.id");
    return { ...input, scopeType: "resource", scopeId: resource.id };
  }
  const customId = "id" in nextScope ? nextScope.id : undefined;
  if (!customId) throw new Error(`${nextScope.type} storage scope requires id`);
  return { ...input, scopeType: nextScope.type, scopeId: customId };
};

export const createStorageApi = (
  deps: ExtensionsRouteDeps,
  input: StorageApiInput,
): CommandRunnerEnvironment["storage"] => {
  const read = createReadBoundary(input.signal);
  const scope = {
    extension_instance_id: input.extensionInstanceId,
    scope_type: input.scopeType ?? "project",
    scope_id: input.scopeId ?? input.projectId,
  };

  const api: CommandRunnerEnvironment["storage"] = {
    observe(changed, options) {
      let closed = Boolean(input.signal?.aborted || options?.signal?.aborted);
      const stop = closed
        ? () => {}
        : deps.extensionStorageService.watch((event) => {
            if (closed || event.workbenchId !== input.projectId || event.extensionId !== input.extensionId) return;
            if (options?.recordIds && event.recordIds && !event.recordIds.some((id) => options.recordIds?.includes(id)))
              return;
            // Private text/owner metadata notifications do not change structured record queries.
            if (event.documentId && event.documentId !== "records") return;
            try {
              changed({ recordIds: event.recordIds });
            } catch (err) {
              apiLogger.warn({ err, event: "storage.observer_failed" }, "Storage observer failed");
            }
          });
      const close = () => {
        closed = true;
        stop();
        input.signal?.removeEventListener("abort", close);
        options?.signal?.removeEventListener("abort", close);
      };
      if (!closed) {
        input.signal?.addEventListener("abort", close, { once: true });
        options?.signal?.addEventListener("abort", close, { once: true });
      }
      input.scope?.register(close);
      return { close };
    },
    canMigrate: async () => true,
    migrate: (version, run) =>
      deps.extensionStorageService.migrate(scope, version, async (previous) => {
        input.signal?.throwIfAborted();
        await run(
          previous,
          createStorageMigration([input.extensionId, input.projectId, scope.scope_type, scope.scope_id, version]),
        );
        input.signal?.throwIfAborted();
      }),
    ids: { create: createStorageId },
    positions: deps.storagePositions,
    readLegacy: async () => undefined,
    records: createExtensionRecordsApi(deps, { ...input, scopeType: scope.scope_type, scopeId: scope.scope_id }),
    text: (recordId, field) => ({
      edit: (edits) =>
        api.records.commit({ operationId: createStorageId(), edits: [{ recordId, text: { [field]: edits } }] }),
    }),
    log: (name, options) =>
      createExtensionLogApi(deps, { ...input, scopeType: scope.scope_type, scopeId: scope.scope_id }, name, options),
    assets: createExtensionAssetsApi(deps, input),
    files: createExtensionBlobsApi(deps, {
      extensionInstanceId: input.extensionInstanceId,
      extensionId: input.extensionId,
      signal: input.signal,
      projectId: input.projectId,
      scopeType: scope.scope_type,
      scopeId: scope.scope_id,
    }),
    scope(nextScope) {
      return createStorageApi(deps, resolveStorageScopeInput(input, nextScope));
    },
    async get(key) {
      const row = await read(() => deps.extensionStorageService.getKv(scope, key));
      return row?.value_json as never;
    },
    async set(key, value) {
      await deps.extensionStorageService.setKv({ ...scope, key, value_json: value, project_id: input.projectId });
    },
    async delete(key) {
      await deps.extensionStorageService.deleteKv(scope, key);
    },
    collection(name) {
      return {
        async read(id) {
          const row = await read(() =>
            deps.extensionStorageService.readCollectionItem({ ...scope, collection: name }, id),
          );
          return row ? { value: row.value_json as never, revision: row.revision } : undefined;
        },
        async get(id) {
          const row = await read(() =>
            deps.extensionStorageService.getCollectionItem({ ...scope, collection: name }, id),
          );
          return row?.value_json as never;
        },
        async list() {
          const rows = await read(() => deps.extensionStorageService.listCollection({ ...scope, collection: name }));
          return rows.map((row) => row.value_json) as never;
        },
        async put(id, value) {
          await deps.extensionStorageService.setCollectionItem({
            ...scope,
            collection: name,
            item_id: id,
            value_json: value,
            project_id: input.projectId,
          });
        },
        async update(id, value) {
          const updated = await deps.extensionStorageService.updateCollectionItem({
            ...scope,
            collection: name,
            item_id: id,
            value_json: value,
          });
          if (!updated) throw new Error(`Item not found: ${id}`);
        },
        updateIfUnchanged(id, revision, value) {
          return deps.extensionStorageService.updateCollectionItemIfUnchanged({
            ...scope,
            collection: name,
            item_id: id,
            value_json: value,
            revision,
          });
        },
        async createIfAbsent(id, value) {
          return deps.extensionStorageService.createCollectionItemIfAbsent({
            ...scope,
            collection: name,
            item_id: id,
            value_json: value,
            project_id: input.projectId,
          });
        },
        async deleteIfValue(id, value) {
          return deps.extensionStorageService.deleteCollectionItemIfValue({ ...scope, collection: name }, id, value);
        },
        async create(value) {
          const id = crypto.randomUUID();
          await this.put(id, value);
          return { ...(typeof value === "object" && value !== null ? value : {}), id } as never;
        },
        async delete(id) {
          await deps.extensionStorageService.deleteCollectionItem({ ...scope, collection: name }, id);
        },
        attachments(itemId) {
          return createExtensionBlobsApi(deps, {
            extensionInstanceId: input.extensionInstanceId,
            extensionId: input.extensionId,
            signal: input.signal,
            projectId: input.projectId,
            scopeType: `collection:${name}`,
            scopeId: itemId,
          });
        },
      };
    },
  };

  return guardPublicationStorage(api, createPublicationStorageAccess(deps, input));
};
