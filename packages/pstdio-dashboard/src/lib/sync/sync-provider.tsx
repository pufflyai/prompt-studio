import type { WorkbenchCore } from "@pstdio/workbench";
import { WorkbenchConnectionProvider } from "@pstdio/workbench/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { buildApiUrl } from "@/lib/api";
import { BackendConnectionStatus } from "./backend-connection-status";
import { getAllCollections, markInitialCollectionsSyncComplete } from "./collections";
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
    getAllCollections();
    const apiUrl = buildApiUrl("").replace(/\/$/, "");
    const client = startSync(apiUrl, {
      onConnected: () => {
        setConnected(true);
        markInitialCollectionsSyncComplete();
      },
      onDisconnected: () => setConnected(false),
      onConnectionLost: () => setConnected(false),
    });

    return () => {
      client.close();
    };
  }, []);

  return (
    <ConnectionStatusSettingsContext value={connectionStatusSettings}>
      <WorkbenchConnectionProvider connected={connected}>{children}</WorkbenchConnectionProvider>
    </ConnectionStatusSettingsContext>
  );
};
