import type { ExtensionAssetsApi } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionsRouteDeps } from "../deps";

export const createExtensionAssetsApi = (
  deps: ExtensionsRouteDeps,
  input: { extensionInstanceId: string; projectId: string; signal?: AbortSignal },
) => {
  const service = deps.assetTransferService;
  const owner = async () => {
    input.signal?.throwIfAborted();
    const record = await deps.extensionService.getProjectExtensionInstance(input.projectId, input.extensionInstanceId);
    if (!record) throw new Error("Asset owner not found");
    return { workbenchId: input.projectId, extensionId: record.installedSource.extension_id };
  };
  const api: ExtensionAssetsApi = {
    stage: async ({ operationId, source }) => service.stage(await owner(), operationId, source, input.signal),
    getTransfer: async (operationId) => (await service.get(await owner(), operationId, input.signal)) ?? undefined,
    cancel: async (operationId) => (await service.cancel(await owner(), operationId)) ?? undefined,
    read: async (asset) => service.read(await owner(), asset, input.signal),
    verifyComplete: async (assets) => service.verifyComplete(await owner(), assets, input.signal),
  };
  return api;
};
