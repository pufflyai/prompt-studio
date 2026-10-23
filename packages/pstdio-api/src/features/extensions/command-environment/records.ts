import type { ExtensionRecordsApi } from "pstdio-api-contracts/extension-kernel";
import { createReadBoundary } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { createRecordAssets } from "./record-assets";

export const createExtensionRecordsApi = (
  deps: ExtensionsRouteDeps,
  input: {
    extensionInstanceId: string;
    projectId: string;
    signal?: AbortSignal;
    scopeType: string;
    scopeId: string;
  },
) => {
  const open = async () => {
    input.signal?.throwIfAborted();
    const record = await deps.extensionService.getProjectExtensionInstance(input.projectId, input.extensionInstanceId);
    input.signal?.throwIfAborted();
    if (!record) throw new Error("Storage owner not found");
    const owner = { workbenchId: input.projectId, extensionId: record.installedSource.extension_id };
    const storage = await deps.extensionStorageService.open({
      owner,
      assets: createRecordAssets(deps.assetTransferService, owner, input.signal),
    });
    return storage.scopedRecords(input.scopeType, input.scopeId);
  };
  let opened: ReturnType<typeof open> | undefined;
  const records = () => {
    input.signal?.throwIfAborted();
    opened ??= open();
    return opened;
  };
  const read = createReadBoundary(input.signal);
  const api: ExtensionRecordsApi = {
    id: (key) => deps.extensionStorageService.recordId(input.scopeType, input.scopeId, key),
    read: (id, branch) => read(async () => (await records()).read(id, branch)),
    list: () => read(async () => (await records()).list()),
    defineIndexes: async (indexes) => (await records()).defineIndexes(indexes),
    query: (query) => read(async () => (await records()).query(query)),
    aggregate: (query) => read(async () => (await records()).aggregate(query)),
    readMany: (ids) => read(async () => (await records()).readMany(ids)),
    commit: async (group) => (await records()).commit(group),
    outcome: (id) => read(async () => (await records()).outcome(id)),
    conflicts: () => read(async () => (await records()).conflicts()),
    inspect: (id) => read(async () => (await records()).inspect(id)),
    resolve: async (proposal) => (await records()).resolve(proposal),
  };
  return api;
};
