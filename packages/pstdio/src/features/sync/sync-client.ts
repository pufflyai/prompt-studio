import { createClient, type SyncConnection } from "@pstdio/sdk/client";
import { getWriter, type SyncedTable } from "./collections";

export type SyncClient = SyncConnection;

export const startSync = (apiUrl: string): SyncClient =>
  createClient({ baseUrl: apiUrl }).sync.start({
    getWriter: (table) => getWriter(table as SyncedTable),
  });
