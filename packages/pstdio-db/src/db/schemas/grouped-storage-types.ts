import type { Receipt, Snapshot } from "pstdio-sync-contracts";

export type AcceptedHeader = Omit<Snapshot, "receipts"> & {
  receipts: Record<string, Omit<Receipt, "mutation">>;
};
