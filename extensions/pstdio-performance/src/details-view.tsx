import "@pstdio/ui/style.css";
import { createWebviewClient, defineExtensionView, type WebviewPerformanceClient } from "@pstdio/sdk/extensions";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { PerformancePopoverContent } from "./components/performance-popover-content";
import { PerformanceRoot } from "./components/performance-root";
import { createSnapshotStore, type SnapshotStore } from "./snapshot-store";

interface DetailsProps {
  store: SnapshotStore;
  performance: WebviewPerformanceClient;
}

const Details = (props: DetailsProps) => {
  const { store, performance } = props;
  const snapshot = useSyncExternalStore(store.subscribe, store.get);
  const readError = useSyncExternalStore(store.subscribe, store.getError);
  const [copied, setCopied] = useState(false);
  // The check mark confirms one copy, then the button offers to copy again.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);
  const [error, setError] = useState<string>();
  const run = (action: Promise<unknown>) => {
    setError(undefined);
    action.catch((cause) => setError(String(cause)));
  };
  const copy = async () => {
    // Copy the latest reading, not the one this view last drew.
    const latest = await performance.snapshot();
    if (!latest) return;
    await navigator.clipboard.writeText(JSON.stringify(latest, null, 2));
    setCopied(true);
  };

  return (
    <PerformancePopoverContent
      snapshot={snapshot}
      error={readError}
      copied={copied}
      actionError={error}
      onCopy={() => run(copy())}
      onDismissActionError={() => setError(undefined)}
      onPause={(installedExtensionId) => run(performance.pauseExtension(installedExtensionId))}
      onResume={(installedExtensionId) => run(performance.resumeExtension(installedExtensionId))}
    />
  );
};

export default defineExtensionView({
  render(context) {
    const client = createWebviewClient(context.host);
    const root = createRoot(context.mount);
    root.render(
      <PerformanceRoot context={context}>
        <Details store={createSnapshotStore(client.performance)} performance={client.performance} />
      </PerformanceRoot>,
    );
    return () => root.unmount();
  },
});
