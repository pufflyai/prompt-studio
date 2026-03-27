import { createContext, useContext, useEffect, useState } from "react";
import { buildApiUrl } from "@/lib/api";
import { type BackendConnectionStatus, getNextBackendConnectionStatus } from "./backend-connection-dot";
import { getAllCollections } from "./collections";
import { ConnectionLost } from "./pages/connection-lost";
import { startSync } from "./sync-client";

const BackendConnectionStatusContext = createContext<BackendConnectionStatus>("connecting");

export const useBackendConnectionStatus = () => {
  return useContext(BackendConnectionStatusContext);
};

export const SyncProvider = ({ children }: { children: React.ReactNode }) => {
  const [connectionStatus, setConnectionStatus] = useState<BackendConnectionStatus>("connecting");
  const [connectionLost, setConnectionLost] = useState(false);

  useEffect(() => {
    getAllCollections();

    const apiUrl = buildApiUrl("").replace(/\/$/, "");
    const client = startSync(apiUrl, {
      onConnected: () => {
        setConnectionLost(false);
        setConnectionStatus((prev) => getNextBackendConnectionStatus(prev, "connected"));
      },
      onDisconnected: () => {
        setConnectionStatus((prev) => getNextBackendConnectionStatus(prev, "disconnected"));
      },
      onConnectionLost: () => {
        setConnectionLost(true);
      },
    });

    return () => {
      client.close();
    };
  }, []);

  return (
    <BackendConnectionStatusContext.Provider value={connectionStatus}>
      {connectionLost ? <ConnectionLost /> : children}
    </BackendConnectionStatusContext.Provider>
  );
};
