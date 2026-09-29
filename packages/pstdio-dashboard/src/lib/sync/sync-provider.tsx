import type { WorkbenchCore } from "@pstdio/workbench";
import { WorkbenchConnectionProvider } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";
import { buildApiUrl } from "@/lib/api";
import { BackendConnectionWarning } from "./backend-connection-warning";
import { getAllCollections, markInitialCollectionsSyncComplete } from "./collections";
import { startSync } from "./sync-client";

interface SyncProviderProps {
  children: React.ReactNode;
  workbench: WorkbenchCore;
}

export const SyncProvider = (props: SyncProviderProps) => {
  const { children, workbench } = props;
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    if (connected) return;
    const id = "dashboard.backend-connection";
    const view = workbench.views.registerView({
      id,
      title: "Backend connection",
      body: { kind: "react", render: () => <BackendConnectionWarning /> },
    });
    const item = workbench.statusBar.registerItem({ id, viewId: id, slot: "trailing" });
    return () => {
      item.dispose();
      view.dispose();
    };
  }, [workbench, connected]);

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

  return <WorkbenchConnectionProvider connected={connected}>{children}</WorkbenchConnectionProvider>;
};
