import type { NativeDocumentTarget } from "pstdio-api-contracts";
import type { StorageOwner } from "pstdio-sync";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { createNativeFileCopy } from "./file-copy";
import type { loadNativeMarkdownFile, saveNativeMarkdownFile } from "./file-source";
import { NativeDocumentSourceError } from "./source-error";
import { checkpointInitialState, checkpointText } from "./text-checkpoint";

interface Address {
  owner: StorageOwner;
  documentKey: string;
}
type Loaded = Awaited<ReturnType<typeof loadNativeMarkdownFile>>;

export const createNativeFileProjector = (deps: {
  storage: ExtensionsRouteDeps["extensionStorageService"];
  load: (input: Parameters<typeof loadNativeMarkdownFile>[1]) => ReturnType<typeof loadNativeMarkdownFile>;
  save: (input: Parameters<typeof saveNativeMarkdownFile>[1]) => ReturnType<typeof saveNativeMarkdownFile>;
}) => {
  const projections = deps.storage.nativeFileProjections;
  const jobs = new Map<string, Promise<unknown>>();
  const canonical = (address: Address) =>
    deps.storage.openNativeTextDocument({ owner: address.owner, fileId: address.documentKey });
  const observe = async (address: Address, loaded: Loaded) => {
    if (loaded.copy)
      await createNativeFileCopy(deps.storage, { ...address, projectionKey: loaded.copy.projectionKey }).observe(
        loaded.copy.content,
      );
  };
  const initialize = async (address: Address) => {
    if (await projections.read(address)) return;
    const state = await canonical(address).exportUpdate();
    await projections.initialize({ ...address, state: await checkpointInitialState(state) });
  };
  const serialize = <T>(address: Address, action: () => Promise<T>) => {
    const key = JSON.stringify([address.owner, address.documentKey]);
    const result = (jobs.get(key) ?? Promise.resolve()).catch(() => {}).then(action);
    jobs.set(key, result);
    const forget = () => {
      if (jobs.get(key) === result) jobs.delete(key);
    };
    void result.then(forget, forget);
    return result;
  };
  return {
    initialize: async (address: Address, loaded: Loaded) => {
      if (await projections.read(address)) return;
      return serialize(address, async () => {
        // An open may have loaded before a queued save. Only the serialized reconciler
        // observes later physical copies against an existing projection baseline.
        if (await projections.read(address)) return;
        await observe(address, loaded);
        await initialize(address);
      });
    },
    reconcile(address: Address) {
      return serialize(address, async () => {
        const target = await deps.storage.nativeRooms.source(address);
        if (!target) throw new Error("Native document source not found");
        const input: NativeDocumentTarget & { projectId: string } = { ...target, projectId: address.owner.workbenchId };
        const loaded = await deps.load(input);
        if (loaded.documentKey !== address.documentKey || loaded.owner.extensionId !== address.owner.extensionId)
          throw new NativeDocumentSourceError(
            400,
            "native_document_source_changed",
            "Native document source changed its owner",
          );
        await observe(address, loaded);
        await initialize(address);
        const saved = (await projections.read(address))!;
        const state = await canonical(address).exportUpdate();
        const content = checkpointText(state);
        // Only physical copies are outside-write evidence. A downloaded record or asset is not an edit.
        if (saved.baseline && content === checkpointText(saved.baseline) && !saved.pending) return;
        await projections.begin({ ...address, state });
        await deps.save({
          ...input,
          content,
          fileStorageVersions: loaded.fileStorageVersions,
          ...(loaded.copy ? { projection: { ...address, projectionKey: loaded.copy.projectionKey, state } } : {}),
        });
        await projections.complete({ ...address, state });
      });
    },
  };
};
