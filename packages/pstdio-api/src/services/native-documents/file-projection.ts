import type { NativeDocumentTarget } from "pstdio-api-contracts";
import { editProjectedText, type StorageOwner, seedTextDocument } from "pstdio-sync";
import * as Y from "yjs";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import type { loadNativeMarkdownFile, saveNativeMarkdownFile } from "./file-source";

interface Address {
  owner: StorageOwner;
  documentKey: string;
}
const sourceText = (state: Uint8Array) => {
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, state);
    return document.getText("content").toString();
  } finally {
    document.destroy();
  }
};

export const createNativeFileProjector = (deps: {
  storage: ExtensionsRouteDeps["extensionStorageService"];
  load: (input: Parameters<typeof loadNativeMarkdownFile>[1]) => ReturnType<typeof loadNativeMarkdownFile>;
  save: (input: Parameters<typeof saveNativeMarkdownFile>[1]) => ReturnType<typeof saveNativeMarkdownFile>;
}) => {
  const projections = deps.storage.nativeFileProjections;
  const jobs = new Map<string, Promise<unknown>>();
  const canonical = (address: Address) =>
    deps.storage.openNativeTextDocument({ owner: address.owner, fileId: address.documentKey });
  const initialize = async (address: Address, source: string) => {
    if (await projections.read(address)) return;
    let state = await canonical(address).exportUpdate();
    if (sourceText(state) !== source) {
      // An unchanged local file is a baseline, not an edit that reverts a downloaded peer document.
      const baseline = new Y.Doc();
      try {
        await seedTextDocument(baseline, source);
        state = Y.encodeStateAsUpdate(baseline);
      } finally {
        baseline.destroy();
      }
    }
    await projections.initialize({ ...address, state });
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
  const mergeOutside = async (
    address: Address,
    source: string,
    saved: { baseline: Uint8Array; pending: Uint8Array | null },
  ) => {
    const text = canonical(address);
    const current = await text.exportUpdate();
    // A process may have written the file and stopped before recording completion.
    // Retain that save intent so replay also finishes any later steps in its handler.
    if (sourceText(current) === source) {
      await projections.baseline({ ...address, state: current });
    } else if (saved.pending && sourceText(saved.pending) === source) {
      await projections.baseline({ ...address, state: saved.pending });
    } else if (sourceText(saved.baseline) !== source) {
      const outside = await editProjectedText(saved.baseline, source);
      try {
        await text.applySource(outside);
        await projections.baseline({ ...address, state: Y.encodeStateAsUpdate(outside) });
      } finally {
        outside.destroy();
      }
    }
  };
  return {
    initialize: (address: Address, source: string) => serialize(address, () => initialize(address, source)),
    reconcile(address: Address) {
      return serialize(address, async () => {
        const target = await deps.storage.nativeRooms.source(address);
        if (!target) throw new Error("Native document source not found");
        const input: NativeDocumentTarget & { projectId: string } = { ...target, projectId: address.owner.workbenchId };
        const loaded = await deps.load(input);
        if (loaded.documentKey !== address.documentKey || loaded.owner.extensionId !== address.owner.extensionId)
          throw new Error("Native document source changed its owner");
        const source = loaded.content.content ?? "";
        await initialize(address, source);
        const saved = (await projections.read(address))!;
        const text = canonical(address);
        await mergeOutside(address, source, saved);
        const state = await text.exportUpdate();
        const content = sourceText(state);
        if (content === source && !saved.pending) {
          await projections.baseline({ ...address, state });
          return;
        }
        await projections.begin({ ...address, state });
        await deps.save({ ...input, content, fileStorageVersions: loaded.fileStorageVersions });
        await projections.complete({ ...address, state });
      });
    },
  };
};
