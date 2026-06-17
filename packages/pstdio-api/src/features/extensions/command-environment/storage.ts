import type { CommandRunnerEnvironment } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { createExtensionBlobsApi } from "./blobs";

type StorageApiInput = {
  extensionInstanceId: string;
  projectId: string;
  scopeType?: string;
  scopeId?: string;
};

type RuntimeStorageScope = Parameters<CommandRunnerEnvironment["storage"]["scope"]>[0];

const resolveStorageScopeInput = (input: StorageApiInput, nextScope: RuntimeStorageScope) => {
  if (nextScope.type === "project") return input;
  if (nextScope.type === "repo") {
    const repoId = "repoId" in nextScope ? nextScope.repoId : undefined;
    if (!repoId) throw new Error("repo storage scope requires repoId");
    return { ...input, scopeType: "repo", scopeId: repoId };
  }
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
  const scope = {
    extension_instance_id: input.extensionInstanceId,
    scope_type: input.scopeType ?? "project",
    scope_id: input.scopeId ?? input.projectId,
  };

  const api: CommandRunnerEnvironment["storage"] = {
    files: createExtensionBlobsApi(deps, {
      extensionInstanceId: input.extensionInstanceId,
      projectId: input.projectId,
      scopeType: scope.scope_type,
      scopeId: scope.scope_id,
    }),
    scope(nextScope) {
      return createStorageApi(deps, resolveStorageScopeInput(input, nextScope));
    },
    async get(key) {
      const row = await deps.extensionStorageService.getKv(scope, key);
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
          const row = await deps.extensionStorageService.getCollectionItem({ ...scope, collection: name }, id);
          return row?.value_json as never;
        },
        async list() {
          const rows = await deps.extensionStorageService.listCollection({ ...scope, collection: name });
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
