import type { createDocumentStorage } from "pstdio-sync";
import type { Asset } from "pstdio-sync-contracts";
import { type Publication, packageMetadataSchema, selectionSchema } from "./types";

/** A mutable package selector points at one immutable metadata-and-bytes record. */
export const createPublicationCatalog = (storage: Pick<ReturnType<typeof createDocumentStorage>, "records">) => {
  const resolve = async (selected: Awaited<ReturnType<typeof storage.records.read>>) => {
    const id = selected.recordId;
    if (selected.deleted || selected.value === null) return { ...selected, value: null, asset: null };
    const selection = selectionSchema.parse(selected.value);
    const pkg = await storage.records.read(`package:${selection.revision}`);
    const metadata = packageMetadataSchema.parse(pkg.value);
    if (metadata.extensionId !== id || !pkg.asset || pkg.asset.sha256 !== selection.revision)
      throw new Error("Published package identity mismatch");
    return { ...selected, value: { ...metadata, ...selection }, asset: pkg.asset };
  };
  return {
    read: async (id: string) => resolve(await storage.records.read(id)),
    list: async () =>
      Promise.all(
        (await storage.records.list())
          .filter((record) => !record.recordId.startsWith("package:") && !record.deleted)
          .map(resolve),
      ),
    select: async (publication: Publication, asset: Asset, expectedRevision?: string) => {
      if (asset.sha256 !== publication.revision) throw new Error("Published package identity mismatch");
      return storage.records.commit({
        operationId: crypto.randomUUID(),
        edits: [
          {
            recordId: `package:${publication.revision}`,
            replace: {
              extensionId: publication.extensionId,
              version: publication.version,
              automation: publication.automation,
            },
            asset,
          },
          {
            recordId: publication.extensionId,
            expectedRevision,
            replace: { revision: publication.revision, enabled: publication.enabled },
          },
        ],
      });
    },
  };
};
