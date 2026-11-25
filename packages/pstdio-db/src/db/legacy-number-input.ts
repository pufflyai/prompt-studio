import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { resourceNumbersDocumentId } from "pstdio-sync/records";
import { exportDocumentFiles } from "../services/extension-storage/document-file-export";
import { withDocumentFileTransaction } from "../services/extension-storage/document-files";
import { storageOwnerKey } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import type { documents } from "./schemas/documents";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type Row = typeof documents.$inferSelect;
const normalize = (input: Record<string, unknown>) =>
  ({
    ...input,
    id: Number(input.id),
    owner_id: Number(input.owner_id),
    revision: Number(input.revision),
    folded_revision: Number(input.folded_revision),
    state_bytes: Number(input.state_bytes),
    room_of: input.room_of === null ? null : Number(input.room_of),
  }) as Row;

/** Preserve the exact residual graph, including its immutable checkpoint, update and
 * retry files. The released SQL graph also remains in the one-time upgrade archive. */
export const prepareLegacyNumberInput = async (db: DbClient, database: string, owner: StorageOwner) => {
  const [{ id }] = (await db.execute<{ id: number }>(sql`SELECT ${storageOwnerKey(owner)} AS id`)).rows;
  let graphHash = "";
  const name = `legacy-number-${id}-documents`;
  const snapshot = await prepareUpgradeSnapshot(
    db,
    database,
    {
      table: "documents",
      keys: ["owner_id", "key"],
      where: sql`owner_id=${id} AND key=${resourceNumbersDocumentId}`,
      name,
      archive: () => `legacy-number-${id}-${graphHash}-documents`,
    },
    async (input) =>
      withDocumentFileTransaction(db, async (tx) => {
        const {
          rows: [current],
        } = await tx.execute<Record<string, unknown>>(
          sql`SELECT * FROM documents WHERE owner_id=${id} AND key=${resourceNumbersDocumentId}`,
        );
        const { source_owner, files, ...original } = input;
        if (
          !isDeepStrictEqual(source_owner, owner) ||
          !current ||
          !isDeepStrictEqual(normalize(current), original) ||
          !isDeepStrictEqual(await exportDocumentFiles(tx, owner.workbenchId, normalize(current)), files)
        )
          throw new Error("Legacy number input changed during admission");
      }),
    async (input) =>
      withDocumentFileTransaction(db, async (tx) => {
        const row = normalize(input);
        return { ...row, source_owner: owner, files: await exportDocumentFiles(tx, owner.workbenchId, row) };
      }),
  );
  if (!snapshot) return async () => {};
  if (database !== ":memory:") {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(`${database}-${name}-upgrade.jsonl`)) hash.update(chunk);
    graphHash = hash.digest("hex");
  }
  return async () => {
    await snapshot(true);
    await snapshot.complete();
  };
};
