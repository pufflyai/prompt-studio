import "@pstdio/ui/style.css";
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { PerformanceMeter, PerformanceMeterOff } from "./components/performance-meter";
import { createSnapshotStore, type SnapshotStore } from "./snapshot-store";
import { PerformanceTranslations } from "./translations";

const Meter = (props: { store: SnapshotStore }) => {
  const { store } = props;
  const snapshot = useSyncExternalStore(store.subscribe, store.get);
  // The meter always draws something: a status webview with no width is never laid out again.
  return snapshot ? <PerformanceMeter snapshot={snapshot} /> : <PerformanceMeterOff />;
};

export default defineExtensionView({
  render(context) {
    const client = createWebviewClient(context.host);
    // Holds the shared capture while the meter is loaded. It never turns monitoring on.
    // A host without capture ownership still serves snapshots, so a failed lease only means nothing to release.
    const lease = client.performance.retain().catch(() => undefined);
    const root = createRoot(context.mount);
    root.render(
      <PerformanceTranslations value={{ locale: context.locale, t: context.t }}>
        <Meter store={createSnapshotStore(client.performance)} />
      </PerformanceTranslations>,
    );
    return () => {
      root.unmount();
      void lease.then((release) => release?.()).catch(() => {});
    };
  },
});
