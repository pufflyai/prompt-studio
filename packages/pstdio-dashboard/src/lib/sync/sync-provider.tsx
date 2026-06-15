import { createContext, useContext, useEffect, useState } from "react";
import { buildApiUrl } from "@/lib/api";
import { type BackendConnectionStatus, getNextBackendConnectionStatus } from "./backend-connection-dot";
import { getAllCollections, markInitialCollectionsSyncComplete } from "./collections";
import { startSync } from "./sync-client";

const BackendConnectionStatusContext = createContext<BackendConnectionStatus>("connecting");

export const useBackendConnectionStatus = () => {
  return useContext(BackendConnectionStatusContext);
};

export const SyncProvider = ({ children }: { children: React.ReactNode }) => {
  const [connectionStatus, setConnectionStatus] = useState<BackendConnectionStatus>("connecting");

  useEffect(() => {
    getAllCollections();

    const apiUrl = buildApiUrl("").replace(/\/$/, "");
    const markDisconnected = () => {
      setConnectionStatus((prev) => getNextBackendConnectionStatus(prev, "disconnected"));
    };
    const client = startSync(apiUrl, {
      onConnected: () => {
        markInitialCollectionsSyncComplete();
        setConnectionStatus((prev) => getNextBackendConnectionStatus(prev, "connected"));
      },
      onDisconnected: markDisconnected,
      onConnectionLost: markDisconnected,
    });

    return () => {
      client.close();
    };
  }, []);

  return (
    <BackendConnectionStatusContext.Provider value={connectionStatus}>
      {children}
    </BackendConnectionStatusContext.Provider>
  );
};
