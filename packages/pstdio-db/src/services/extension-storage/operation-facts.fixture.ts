import { operations } from "../../db/schemas/storage-ordered-records";
import type { OrderedTransaction } from "./ordered-sql";

/** Inspect every exact fact, including multiple epochs for the same identity. */
export const readOperationReceipts = async (db: Pick<OrderedTransaction, "select">) =>
  (await db.select().from(operations)).flatMap((row) =>
    Object.entries(row.receipt).map(([epoch, receipt]) => ({
      owner_id: row.owner_id,
      operation_id: row.operation_id,
      epoch,
      admission_fingerprint: receipt.admissionFingerprint,
      state: receipt.state,
      indexed: receipt.indexed,
    })),
  );
