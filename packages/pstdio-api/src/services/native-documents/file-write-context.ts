import { AsyncLocalStorage } from "node:async_hooks";
import type { StorageOwner } from "pstdio-sync";
import { editProjectedText } from "pstdio-sync/text";
import * as Y from "yjs";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { createNativeFileCopy } from "./file-copy";

const writes = new AsyncLocalStorage<{
  storage: ExtensionsRouteDeps["extensionStorageService"];
  owner: StorageOwner;
  documentKey: string;
  projectionKey: string;
  state: Uint8Array;
}>();
export const withNativeFileWrite = <T>(
  input: NonNullable<ReturnType<typeof writes.getStore>>,
  action: () => Promise<T>,
) => writes.run(input, action);

/** Prepare provenance before writing bytes and confirm it immediately after that write returns. */
export const prepareNativeFileWrite = async (projectionKey: string, bytes: Uint8Array) => {
  const current = writes.getStore();
  if (!current) return undefined;
  if (current.projectionKey !== projectionKey) {
    const expected = JSON.parse(current.projectionKey) as string[];
    const actual = JSON.parse(projectionKey) as string[];
    if (expected[0] === "workspace-file" && actual[0] === expected[0] && expected[2] === actual[2])
      throw new Error("The workspace changed while saving this text source");
    return undefined;
  }
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const projected = await editProjectedText(current.state, source);
  try {
    const state = Y.encodeStateAsUpdate(projected);
    const text = current.storage.openNativeTextDocument({ owner: current.owner, fileId: current.documentKey });
    await text.applySource(projected);
    const copy = createNativeFileCopy(current.storage, current);
    await copy.begin(state);
    return {
      written: async () => {
        await copy.written(state);
        current.state = state;
      },
      cancel: () => copy.cancel(state),
    };
  } finally {
    projected.destroy();
  }
};
