import type { ExtensionStorageApi, ResourceRef, StorageScope } from "@pstdio/sdk/extensions";
import type { createExtensionKvDBService } from "pstdio-db";
import type { BuildEnvironmentInput, CommandRunnerEnvironment } from "pstdio-extensions";

type ExtensionKvService = ReturnType<typeof createExtensionKvDBService>;

const NOT_IMPLEMENTED = (api: string) => () => {
  throw new Error(`Extension API "${api}" is not available in this slice`);
};

const scopeKey = (scope: StorageScope): { scope_type: string; scope_id: string } => {
  if (scope.type === "project") return { scope_type: "project", scope_id: "" };
  if (scope.type === "repo") return { scope_type: "repo", scope_id: (scope as { repoId?: string }).repoId ?? "" };
  if (scope.type === "resource") {
    const ref = (scope as { resource?: ResourceRef }).resource;
    return { scope_type: "resource", scope_id: ref ? `${ref.type}:${ref.id}` : "" };
  }
  return { scope_type: scope.type, scope_id: (scope as { id?: string }).id ?? "" };
};

const buildStorage = (
  ids: BuildEnvironmentInput,
  kv: ExtensionKvService,
  initialScope: StorageScope,
): ExtensionStorageApi => {
  const make = (scope: StorageScope): ExtensionStorageApi => {
    const { scope_type, scope_id } = scopeKey(scope);
    return {
      scope: (next) => make(next),
      get: async (key) => {
        const value = await kv.get({
          project_id: ids.projectId,
          extension_id: ids.extensionId,
          namespace: ids.namespace,
          scope_type,
          scope_id,
          key,
        });
        return value === null ? undefined : (value as never);
      },
      set: async (key, value) => {
        await kv.set({
          project_id: ids.projectId,
          extension_id: ids.extensionId,
          namespace: ids.namespace,
          scope_type,
          scope_id,
          key,
          value,
        });
      },
      delete: async (key) => {
        await kv.delete({
          project_id: ids.projectId,
          extension_id: ids.extensionId,
          namespace: ids.namespace,
          scope_type,
          scope_id,
          key,
        });
      },
      collection: () => {
        throw new Error("storage.collection is not implemented in this slice");
      },
    };
  };
  return make(initialScope);
};

export const buildExtensionEnvironment = (
  kv: ExtensionKvService,
): ((input: BuildEnvironmentInput) => CommandRunnerEnvironment) => {
  return (input) => ({
    storage: buildStorage(input, kv, { type: "project" }),
    artifacts: { mount: NOT_IMPLEMENTED("artifacts.mount") as never },
    files: {
      readText: NOT_IMPLEMENTED("files.readText") as never,
      writeText: NOT_IMPLEMENTED("files.writeText") as never,
      createText: NOT_IMPLEMENTED("files.createText") as never,
      delete: NOT_IMPLEMENTED("files.delete") as never,
    },
    sessions: {
      create: NOT_IMPLEMENTED("sessions.create") as never,
      followup: NOT_IMPLEMENTED("sessions.followup") as never,
    },
    workspaces: {
      get: NOT_IMPLEMENTED("workspaces.get") as never,
      create: NOT_IMPLEMENTED("workspaces.create") as never,
      archive: NOT_IMPLEMENTED("workspaces.archive") as never,
      delete: NOT_IMPLEMENTED("workspaces.delete") as never,
    },
    repos: {
      list: NOT_IMPLEMENTED("repos.list") as never,
      get: NOT_IMPLEMENTED("repos.get") as never,
      getDefault: async () => undefined,
      resolvePath: NOT_IMPLEMENTED("repos.resolvePath") as never,
    },
    activity: { record: NOT_IMPLEMENTED("activity.record") as never },
    notify: {
      // Notifications are best-effort in the API command runner: never throw.
      toast: async () => {},
    },
    process: {
      run: NOT_IMPLEMENTED("process.run") as never,
      spawnDetached: NOT_IMPLEMENTED("process.spawnDetached") as never,
    },
    net: { findFreePort: NOT_IMPLEMENTED("net.findFreePort") as never },
    settings: {
      all: async () => ({}),
      get: async () => undefined,
      set: NOT_IMPLEMENTED("settings.set") as never,
      delete: NOT_IMPLEMENTED("settings.delete") as never,
    },
  });
};
