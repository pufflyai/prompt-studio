import type { JournalEntry } from "pstdio-sync";
import type { Snapshot } from "pstdio-sync-contracts";
import type { AcceptedHeader } from "../../db/schemas/grouped-storage-types";

export const decodeAcceptedState = (header: AcceptedHeader | null, journal: JournalEntry[]) => {
  if (!header) return null;
  if (header.protocolVersion !== 2)
    throw new Error("Resynchronization required: preserve the local journal before updating protocol");
  const entries = new Map(journal.map((entry) => [entry.mutation.operationId, entry]));
  const receipts = Object.fromEntries(
    Object.entries(header.receipts).map(([id, receipt]) => {
      const entry = entries.get(id);
      if (!entry) throw new Error("Accepted receipt has no retained operation");
      const { position, ...operation } = entry.mutation;
      if (!position) throw new Error("Accepted operation has no writer position");
      return [
        id,
        {
          ...receipt,
          ...(entry.recoveryProof ? { recoveryProof: entry.recoveryProof } : {}),
          mutation: {
            ...operation,
            ...position,
            protocolVersion: 2 as const,
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
      const { mutation: _operation, recoveryProof: _proof, ...metadata } = receipt;
      return [id, metadata];
    }),
  );
  return { ...snapshot, receipts };
};
