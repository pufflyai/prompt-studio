import "@pstdio/ui/style.css";
import { createWebviewClient, defineExtensionView, type WebviewClient } from "@pstdio/sdk/extensions";
import { useScopedQuery } from "@pstdio/sdk/extensions/react";
import { createRoot } from "react-dom/client";
import { PerformanceMeter, PerformanceMeterOff } from "./components/performance-meter";
import { PerformanceRoot } from "./components/performance-root";
import { createSnapshotQuery } from "./snapshot-query";

const Meter = (props: { client: WebviewClient<object> }) => {
  const { client } = props;
  const { data: snapshot } = useScopedQuery(createSnapshotQuery(client));
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
      <PerformanceRoot context={context}>
        <Meter client={client} />
      </PerformanceRoot>,
    );
    return () => {
      root.unmount();
      client.queries.dispose();
      void lease.then((release) => release?.()).catch(() => {});
    };
  },
});
