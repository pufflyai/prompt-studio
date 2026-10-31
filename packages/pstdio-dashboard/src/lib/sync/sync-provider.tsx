import { WorkbenchConnectionProvider } from "@pstdio/workbench/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiClientOptions } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getRuntimeCollections, releaseRuntimeCollections, retainRuntimeCollections } from "./collections";
import { startSync } from "./sync-client";

interface SyncProviderProps {
  children: React.ReactNode;
}

export const SyncProvider = (props: SyncProviderProps) => {
  const { children } = props;
  const { baseUrl, token } = apiClientOptions();
  // A new runtime connection remounts the app, so no view keeps data from the previous one.
  const connectionKey = JSON.stringify({ baseUrl, token });
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    const connection = { baseUrl, token };
    const collections = retainRuntimeCollections(connection);
    collections.getAllCollections();
    const apiUrl = connection.baseUrl;
    const client = startSync(
      apiUrl,
      {
        onConnected: () => {
          setConnected(true);
          collections.markInitialCollectionsSyncComplete();
        },
        onDisconnected: () => setConnected(false),
        onConnectionLost: () => setConnected(false),
      },
      connection,
    );

    return () => {
      client.close();
      void releaseRuntimeCollections(connection);
    };
  }, [baseUrl, token]);

  return (
    <QueryClientProvider
      key={connectionKey}
      client={getDashboardQueryClient(getRuntimeCollections({ baseUrl, token }))}
    >
      <WorkbenchConnectionProvider connected={connected}>{children}</WorkbenchConnectionProvider>
    </QueryClientProvider>
  );
};
