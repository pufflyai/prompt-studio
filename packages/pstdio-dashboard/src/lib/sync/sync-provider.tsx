import { useEffect } from "react";
import { buildApiUrl } from "@/lib/api";
import { getAllCollections, markInitialCollectionsSyncComplete } from "./collections";
import { startSync } from "./sync-client";

export const SyncProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    getAllCollections();

    const apiUrl = buildApiUrl("").replace(/\/$/, "");
    const client = startSync(apiUrl, {
      onConnected: () => {
        markInitialCollectionsSyncComplete();
      },
    });

    return () => {
      client.close();
    };
  }, []);

  return children;
};
