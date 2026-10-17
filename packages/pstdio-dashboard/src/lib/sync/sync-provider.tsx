import type { WorkbenchCore } from "@pstdio/workbench";
import { WorkbenchConnectionProvider } from "@pstdio/workbench/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { apiClientOptions } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { BackendConnectionStatus } from "./backend-connection-status";
import { getRuntimeCollections, releaseRuntimeCollections, retainRuntimeCollections } from "./collections";
import { ConnectionStatusSettingsContext } from "./connection-status-context";
import type { ConnectionStatusSettings } from "./connection-status-settings";
import { startSync } from "./sync-client";

interface SyncProviderProps {
  children: React.ReactNode;
  workbench: WorkbenchCore;
  connectionStatusSettings: ConnectionStatusSettings;
}

export const SyncProvider = (props: SyncProviderProps) => {
  const { children, workbench, connectionStatusSettings } = props;
  const { baseUrl, token } = apiClientOptions();
  const connectionKey = JSON.stringify({ baseUrl, token });
  const [connected, setConnected] = useState(true);
  const showStatus = useSyncExternalStore(connectionStatusSettings.subscribe, connectionStatusSettings.getEnabled);
  useEffect(() => {
    if (!showStatus) return;
    const id = "dashboard.backend-connection";
    const view = workbench.views.registerView({
      id,
      title: "Backend connection",
      body: { kind: "react", render: () => <BackendConnectionStatus connected={connected} /> },
    });
    const item = workbench.statusBar.registerItem({ id, viewId: id, slot: "trailing" });
    return () => {
      item.dispose();
      view.dispose();
    };
  }, [workbench, connected, showStatus]);

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
    <ConnectionStatusSettingsContext key={connectionKey} value={connectionStatusSettings}>
      <QueryClientProvider client={getDashboardQueryClient(getRuntimeCollections({ baseUrl, token }))}>
        <WorkbenchConnectionProvider connected={connected}>{children}</WorkbenchConnectionProvider>
      </QueryClientProvider>
    </ConnectionStatusSettingsContext>
  );
};
