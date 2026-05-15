import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { buildApiUrl } from "@/lib/api";
import { getAllCollections } from "./collections";
import { startSync } from "./sync-client";

export type BackendConnectionStatus = "connecting" | "connected" | "error";

export interface SyncStatus {
  connection: BackendConnectionStatus;
  connectionLost: boolean;
}

const initialStatus: SyncStatus = {
  connection: "connecting",
  connectionLost: false,
};

const SyncStatusContext = createContext<SyncStatus>(initialStatus);

export const useSyncStatus = () => useContext(SyncStatusContext);

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider = (props: SyncProviderProps) => {
  const { children } = props;
  const [status, setStatus] = useState<SyncStatus>(initialStatus);

  useEffect(() => {
    getAllCollections();

    const apiUrl = buildApiUrl("").replace(/\/$/, "");
    const client = startSync(apiUrl, {
      onConnected: () => setStatus({ connection: "connected", connectionLost: false }),
      onDisconnected: () => setStatus((prev) => ({ ...prev, connection: "error" })),
      onConnectionLost: () => setStatus((prev) => ({ ...prev, connectionLost: true })),
    });

    return () => {
      client.close();
    };
  }, []);

  return <SyncStatusContext.Provider value={status}>{children}</SyncStatusContext.Provider>;
};
