import "@pstdio/ui/style.css";
import {
  createWebviewClient,
  defineExtensionView,
  type GuestHost,
  type PerformanceMonitoringState,
} from "@pstdio/sdk/extensions";
import { useWebviewCommandQuery, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  PerformancePopoverContent,
  type PerformancePopoverContentProps,
} from "./components/performance-popover-content";
import { PerformanceRoot } from "./components/performance-root";
import { createSnapshotQuery } from "./snapshot-query";

interface DetailsProps {
  client: ReturnType<typeof createWebviewClient>;
  host: GuestHost;
}

const Details = (props: DetailsProps) => {
  const { client, host } = props;
  const { performance } = client;
  const { data: snapshot, error: readError } = useWebviewCommandQuery(
    createSnapshotQuery(client),
    useWebviewVisibility(),
  );
  const [copied, setCopied] = useState(false);
  // The check mark confirms one copy, then the button offers to copy again.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);
  const [error, setError] = useState<PerformancePopoverContentProps["actionError"]>();
  const [renderOverlay, setRenderOverlay] = useState<PerformanceMonitoringState["renderOverlay"]>();
  const [changingOverlay, setChangingOverlay] = useState(false);
  const visible = useWebviewVisibility();
  useEffect(() => {
    if (!visible || snapshot === undefined) return;
    let active = true;
    void performance.state().then(
      (state) => {
        if (active) setRenderOverlay(state.renderOverlay);
      },
      () => {
        if (active) setRenderOverlay(undefined);
      },
    );
    return () => {
      active = false;
    };
  }, [performance, visible, snapshot]);
  const changeOverlay = async (enabled: boolean) => {
    setChangingOverlay(true);
    try {
      await host.call("performance.control", { operation: "set-render-overlay", enabled });
      setRenderOverlay((await performance.state()).renderOverlay);
    } finally {
      setChangingOverlay(false);
    }
  };
  const run = (action: Promise<unknown>, source: NonNullable<typeof error>["source"] = "metrics") => {
    setError(undefined);
    action.catch((cause) => setError({ message: String(cause), source }));
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
      error={readError?.message}
      copied={copied}
      renderOverlay={{
        state: renderOverlay,
        pending: changingOverlay,
        onEnabledChange: (enabled) => run(changeOverlay(enabled), "render-overlay"),
      }}
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
        <Details client={client} host={context.host} />
      </PerformanceRoot>,
    );
    return () => {
      root.unmount();
      client.queries.dispose();
    };
  },
});
