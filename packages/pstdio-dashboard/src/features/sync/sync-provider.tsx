import { useEffect } from "react";
import { buildApiUrl } from "@/lib/api";
import { getAllCollections } from "./collections";
import { startSync } from "./sync-client";

export const SyncProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    getAllCollections();

    const apiUrl = buildApiUrl("").replace(/\/$/, "");
    const client = startSync(apiUrl);

    return () => {
      client.close();
    };
  }, []);

  return children;
};
