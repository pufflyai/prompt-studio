import { and, gt, inArray, sql } from "drizzle-orm";
import type { DocumentStore, StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { storage_current_records as current, storage_documents as documents } from "../../db/schemas.pg";
import { runDocumentTransaction } from "./document-persistence";
import { orderedFieldMarkerId, readOrderedMarker, saveOrderedMarker } from "./ordered-native-metadata";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

const bootstrapId = JSON.stringify(["ordered-directory"]);
const nativeKey = (id: string) => (id.startsWith('["native-markdown",') ? (JSON.parse(id) as string[])[1] : undefined);

/** Register new shared owners atomically with their first durable write. */
export const registerSharedDocument = async (tx: OrderedTransaction, owner: StorageOwner, id: string) => {
  const result = await runDocumentTransaction(
    tx,
    { owner, address: { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: "records" } },
    async ({ document }) => {
      const directory = document.getMap<boolean>("sync-documents");
      if (!directory.has(id)) directory.set(id, true);
    },
  );
  result.document.destroy();
  return result.changed;
};

/** Local cache/index nodes never become shared Yjs documents or extend the discovery sweep. */
export const createDocumentDirectory = (
  db: DbClient,
  deps: {
    metadata: DocumentStore["transaction"];
    private: (id: string) => boolean;
    invalidate(owner: StorageOwner): void;
  },
) => {
  const shared = (id: string) => id !== "records" && !deps.private(id);
  const discover = async (owner: StorageOwner) => {
    const names: string[] = [];
    let after: string | undefined;
    while (true) {
      const rows = await db
        .select({ id: documents.document_id })
        .from(documents)
        .where(
          and(orderedOwnerWhere(documents, owner), after === undefined ? undefined : gt(documents.document_id, after)),
        )
        .orderBy(documents.document_id)
        .limit(1_000);
      if (!rows.length) return names;
      for (const row of rows) if (shared(row.id)) names.push(row.id);
      after = rows.at(-1)!.id;
    }
  };
  const hiddenFields = async (owner: StorageOwner, names: string[]) => {
    const keys = names.flatMap((id) => nativeKey(id) ?? []);
    const hidden = new Set<string>();
    for (let offset = 0; offset < keys.length; offset += 1_000) {
      const batch = keys.slice(offset, offset + 1_000);
      const rows = await db
        .select({ sources: current.native_sources })
        .from(current)
        .where(
          and(
            orderedOwnerWhere(current, owner),
            sql`${current.native_sources} ?| ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(batch)}::jsonb))`,
          ),
        );
      for (const row of rows)
        for (const [key, source] of Object.entries(row.sources))
          if ("field" in source) hidden.add(JSON.stringify(["native-markdown", key]));
      const markers = await db
        .select({ id: documents.document_id })
        .from(documents)
        .where(
          and(orderedOwnerWhere(documents, owner), inArray(documents.document_id, batch.map(orderedFieldMarkerId))),
        );
      for (const marker of markers)
        hidden.add(JSON.stringify(["native-markdown", (JSON.parse(marker.id) as string[])[1]]));
    }
    return hidden;
  };
  return {
    async register(tx: OrderedTransaction, owner: StorageOwner, id: string) {
      if (!shared(id)) return;
      if (await registerSharedDocument(tx, owner, id)) deps.invalidate(owner);
    },
    async list(owner: StorageOwner) {
      const initialized = await readOrderedMarker(db, owner, bootstrapId);
      const discovered = initialized ? [] : await discover(owner);
      const names = await deps.metadata(owner, async ({ document }) => {
        const directory = document.getMap<boolean>("sync-documents");
        for (const id of discovered) if (!directory.has(id)) directory.set(id, true);
        return [...directory.keys()];
      });
      const hidden = await hiddenFields(owner, names);
      const excluded = names.filter((id) => !shared(id) || hidden.has(id));
      if (excluded.length)
        await deps.metadata(owner, async ({ document }) => {
          const directory = document.getMap<boolean>("sync-documents");
          for (const id of excluded) directory.delete(id);
        });
      if (!initialized) await db.transaction((tx) => saveOrderedMarker(tx, owner, bootstrapId, { ready: true }));
      return ["records", ...names.filter((id) => shared(id) && !hidden.has(id)).sort()];
    },
  };
};
