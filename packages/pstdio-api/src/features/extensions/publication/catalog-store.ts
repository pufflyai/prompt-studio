import { createDocumentStorage } from "pstdio-sync";
import type { Asset } from "pstdio-sync-contracts";
import { type Publication, packageMetadataSchema, selectionSchema } from "./types";

/** A mutable package selector points at one immutable metadata-and-bytes record. */
export const createPublicationCatalog = (input: Parameters<typeof createDocumentStorage>[0]) => {
  const storage = createDocumentStorage(input);
  type Records = typeof storage.records;
  const resolve = async (selected: Awaited<ReturnType<Records["read"]>>, records: Records) => {
    const id = selected.recordId;
    if (selected.deleted || selected.value === null) return { ...selected, value: null, asset: null };
    const selection = selectionSchema.parse(selected.value);
    const pkg = await records.read(`package:${selection.revision}`);
    const metadata = packageMetadataSchema.parse(pkg.value);
    if (metadata.extensionId !== id || !pkg.asset || pkg.asset.sha256 !== selection.revision)
      throw new Error("Published package identity mismatch");
    return { ...selected, value: { ...metadata, ...selection }, asset: pkg.asset };
  };
  const view = (records: Records) => ({
    records,
    read: async (id: string) => resolve(await records.read(id), records),
  });
  const change = <T>(
    id: string,
    expectedRevision: string | undefined,
    action: (catalog: ReturnType<typeof view>) => Promise<T>,
  ) =>
    input.store.transaction(input.owner, async (state) => {
      const locked = createDocumentStorage({
        owner: input.owner,
        store: { transaction: async (_owner, action) => action(state) },
        // select verifies immutable assets before acquiring the document's database transaction.
        assets: input.assets && { ...input.assets, verifyComplete: async () => {} },
      });
      const record = await locked.records.read(id);
      if (expectedRevision !== undefined && record.revision !== expectedRevision)
        throw new Error("Published extension changed; read its revision again");
      return action(view(locked.records));
    });
  return {
    ...storage,
    ...view(storage.records),
    change,
    list: async () =>
      Promise.all(
        (await storage.records.list())
          .filter((record) => !record.recordId.startsWith("package:") && !record.deleted)
          .map((record) => resolve(record, storage.records)),
      ),
    select: async (publication: Publication, asset: Asset, expectedRevision?: string) => {
      if (asset.sha256 !== publication.revision) throw new Error("Published package identity mismatch");
      if (!input.assets) throw new Error("Asset verification is unavailable");
      await input.assets.verifyComplete([asset]);
      return change(publication.extensionId, expectedRevision, ({ records }) =>
        records.commit({
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
              deleted: false,
            },
          ],
        }),
      );
    },
  };
};
