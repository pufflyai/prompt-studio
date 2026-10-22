import { createStorageId, createStorageMigration } from "pstdio-api-contracts";
import { type CommandRunnerEnvironment, createReadBoundary } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { createExtensionAssetsApi } from "./assets";
import { createExtensionBlobsApi } from "./blobs";
import { createExtensionRecordsApi } from "./records";

type StorageApiInput = {
  extensionId: string;
  extensionInstanceId: string;
  projectId: string;
  signal?: AbortSignal;
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
    readLegacy: (source) =>
      read(() =>
        deps.extensionStorageService.readLegacy(source, {
          projectId: input.projectId,
          extensionInstanceId: input.extensionInstanceId,
        }),
      ),
    records: createExtensionRecordsApi(deps, { ...input, scopeType: scope.scope_type, scopeId: scope.scope_id }),
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

  return api;
};
