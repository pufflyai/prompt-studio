import { NativeSourceRecoveryError, type StorageOwner } from "pstdio-sync";
import { editProjectedText } from "pstdio-sync/text";
import * as Y from "yjs";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { checkpointInitialState, checkpointText } from "./text-checkpoint";

const firstBaseline = async (current: Uint8Array, source: string | undefined, known?: Uint8Array) => {
  if (known) return known;
  if (source === undefined) return null;
  if (checkpointText(current) === source) return current;
  const initial = await checkpointInitialState(current);
  if (checkpointText(initial) !== source)
    throw new NativeSourceRecoveryError("This file has no known text history. Its bytes are preserved for recovery.");
  return initial;
};

/** Each physical copy retains its own last observed history, separately from handler completion. */
export const createNativeFileCopy = (
  storage: ExtensionsRouteDeps["extensionStorageService"],
  input: {
    owner: StorageOwner;
    documentKey: string;
    projectionKey: string;
  },
) => {
  const projections = storage.nativeFileProjections;
  const text = storage.openNativeTextDocument({ owner: input.owner, fileId: input.documentKey });
  return {
    async observe(source: string | undefined, knownBaseline?: Uint8Array) {
      let saved = await projections.read(input);
      await text.read();
      const current = await text.exportUpdate();
      if (!saved) {
        const baseline = await firstBaseline(current, source, knownBaseline);
        await projections.initialize({ ...input, state: baseline });
        saved = (await projections.read(input))!;
      }
      if (saved.pending) {
        if (source !== checkpointText(saved.pending))
          throw new NativeSourceRecoveryError(
            "An interrupted file write has an ambiguous result. Its bytes and shared text are preserved.",
          );
        await projections.complete({ ...input, state: saved.pending });
        saved = { ...saved, baseline: saved.pending, pending: null };
      }
      if (source === undefined) return;
      if (!saved.baseline)
        throw new NativeSourceRecoveryError(
          "This file has no confirmed baseline. Its bytes are preserved for recovery.",
        );
      if (checkpointText(saved.baseline) === source) return;
      const outside = await editProjectedText(saved.baseline, source);
      try {
        await text.applySource(outside);
        await projections.baseline({ ...input, state: Y.encodeStateAsUpdate(outside) });
      } finally {
        outside.destroy();
      }
    },
    begin: (state: Uint8Array) => projections.begin({ ...input, state }),
    written: (state: Uint8Array) => projections.complete({ ...input, state }),
    cancel: (state: Uint8Array) => projections.cancel({ ...input, state }),
  };
};
