import {
  type NativeRecordSources,
  nativeAssetBaseline,
  nativeTextAssetKey,
  readTextDocumentSeed,
  type StorageOwner,
} from "pstdio-sync";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { createNativeFileCopy } from "../native-documents/file-copy";
import { checkpointText } from "../native-documents/text-checkpoint";
import { absentFile, type createFileProjectionIO, type FileIdentity, sameFile } from "./file-io";
import { blobHash } from "./file-state";

type Record = { recordId: string; nativeSources?: NativeRecordSources; asset?: { sha256: string } | null };
export const createNativeArtifactProjection = (input: {
  owner: StorageOwner;
  storageService: ExtensionsRouteDeps["extensionStorageService"];
  io: ReturnType<typeof createFileProjectionIO>;
}) => {
  const source = (path: string, record: Record) => {
    const documentKey = nativeTextAssetKey(record)!;
    const text = input.storageService.openNativeTextDocument({ owner: input.owner, fileId: documentKey });
    const copy = createNativeFileCopy(input.storageService, {
      owner: input.owner,
      documentKey,
      projectionKey: input.io.projectionKey(path),
    });
    return { text, copy };
  };
  return {
    async observe(path: string, record: Record, found: Awaited<ReturnType<typeof input.io.source>>) {
      const { text, copy } = source(path, record);
      await text.read();
      const binding = record.nativeSources![nativeTextAssetKey(record)!]!;
      // A renamed file can bind a later native state. Keep that actual history, never infer genesis.
      const baseline =
        found?.hash === record.asset?.sha256 && "asset" in binding ? await nativeAssetBaseline(binding) : undefined;
      const content = found?.file
        ? new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await found.file.arrayBuffer())
        : undefined;
      await copy.observe(content, baseline);
    },
    async project(path: string, record: Record, expected: FileIdentity) {
      const { text, copy } = source(path, record);
      await text.store.transaction(input.owner, async ({ document }) => readTextDocumentSeed(document));
      const state = await text.exportUpdate();
      const content = new Blob([checkpointText(state)]);
      const hash = await blobHash(content);
      const target = { kind: "file" as const, hash };
      if (sameFile(expected, target))
        return { hash, complete: sameFile((await input.io.source(path)) ?? absentFile, expected) };
      await copy.begin(state);
      const complete = await input.io.install(path, target, null, expected, content);
      if (complete) await copy.written(state);
      else await copy.cancel(state);
      return { hash, complete };
    },
  };
};
