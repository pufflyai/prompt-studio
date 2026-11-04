import type { ExtensionLogApi, ExtensionLogOptions } from "pstdio-api-contracts/extension-kernel";
import { createReadBoundary } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";

export const createExtensionLogApi = (
  deps: ExtensionsRouteDeps,
  input: {
    projectId: string;
    extensionId: string;
    extensionInstanceId: string;
    scopeType: string;
    scopeId: string;
    signal?: AbortSignal;
  },
  name: string,
  options: ExtensionLogOptions = {},
) => {
  const read = createReadBoundary(input.signal);
  const selection = structuredClone(options);
  const selectedScope = () => {
    const scope = selection.scope;
    if (!scope) return JSON.stringify([input.scopeType, input.scopeId]);
    if (scope.type === "project") return JSON.stringify(["project", input.projectId]);
    if (scope.type === "resource" && "resource" in scope && scope.resource.id)
      return JSON.stringify(["resource", scope.resource.id]);
    if ("id" in scope && scope.id) return JSON.stringify([scope.type, scope.id]);
    throw new Error("A log scope requires a stable resource or scope ID");
  };
  const open = async () => {
    input.signal?.throwIfAborted();
    const record = await deps.extensionService.getProjectExtensionInstance(input.projectId, input.extensionInstanceId);
    if (!record || record.installedSource.extension_id !== input.extensionId)
      throw new Error("Storage owner not found");
    const snapshot = await deps.extensionRuntimeCatalog.get(input.projectId);
    const declaration = snapshot.runtime.extensions
      .find((extension) => extension.id === input.extensionId)
      ?.definition.storage?.logs?.find((entry) => (typeof entry === "string" ? entry : entry.name) === name);
    if (!declaration) throw new Error(`Log is not declared: ${name}`);
    const definition = typeof declaration === "string" ? { name: declaration } : declaration;
    return deps.extensionStorageService.logs.open(
      { workbenchId: input.projectId, extensionId: input.extensionId },
      definition,
      selectedScope(),
    );
  };
  const api: ExtensionLogApi = {
    async append(value, options) {
      const owned = structuredClone({ value, options });
      return (await open()).append(owned.value, owned.options);
    },
    read: (options) => {
      const owned = structuredClone(options);
      return read(async () => (await open()).read(owned));
    },
    async *follow(options = {}) {
      const signals = [input.signal, options.signal].filter((signal): signal is AbortSignal => !!signal);
      const signal = signals.length ? AbortSignal.any(signals) : undefined;
      yield* (await open()).follow({ after: options.after, signal });
    },
  };
  return api;
};
