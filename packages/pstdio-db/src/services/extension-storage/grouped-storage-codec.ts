import type { JournalEntry } from "pstdio-sync";
import type { Snapshot } from "pstdio-sync-contracts";
import type { AcceptedHeader } from "../../db/schemas/grouped-storage-types";

export const decodeAcceptedState = (header: AcceptedHeader | null, journal: JournalEntry[]) => {
  if (!header) return null;
  const entries = new Map(journal.map((entry) => [entry.mutation.operationId, entry.mutation]));
  const receipts = Object.fromEntries(
    Object.entries(header.receipts).map(([id, receipt]) => {
      const operation = entries.get(id);
      if (!operation) throw new Error("Accepted receipt has no retained operation");
      return [
        id,
        {
          ...receipt,
          mutation: {
            ...operation,
            protocolVersion: 1 as const,
            scope: header.scope,
            fingerprint: receipt.fingerprint,
          },
        },
      ];
    }),
  );
  return { ...header, receipts };
};

export const encodeAcceptedState = (snapshot: Snapshot | null) => {
  if (!snapshot) return null;
  const receipts = Object.fromEntries(
    Object.entries(snapshot.receipts).map(([id, receipt]) => {
      const { mutation: _operation, ...metadata } = receipt;
      return [id, metadata];
    }),
  );
  return { ...snapshot, receipts };
};
