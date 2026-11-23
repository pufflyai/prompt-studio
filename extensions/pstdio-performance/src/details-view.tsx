import "@pstdio/ui/style.css";
import { createWebviewClient, defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { useWebviewCommandQuery, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import {
  PerformancePopoverContent,
  type PerformancePopoverContentProps,
} from "./components/performance-popover-content";
import { PerformanceRoot } from "./components/performance-root";
import { createPerformanceActions } from "./performance-actions";
import { createSnapshotQuery } from "./snapshot-query";

interface DetailsProps {
  client: ReturnType<typeof createWebviewClient>;
  host: GuestHost;
}

const Details = (props: DetailsProps) => {
  const { client, host } = props;
  const { performance } = client;
  const visible = useWebviewVisibility();
  const [query] = useState(() => createSnapshotQuery(client));
  const { data: snapshot, error: readError } = useWebviewCommandQuery(query, visible);
  const [actions] = useState(() =>
    createPerformanceActions({
      readOverlay: async () => (await performance.state()).renderOverlay,
      writeOverlay: (enabled) => host.call("performance.control", { operation: "set-render-overlay", enabled }),
      async copy() {
        // Copy the latest reading, not the one this view last drew.
        const latest = await performance.snapshot();
        if (!latest) return false;
        await navigator.clipboard.writeText(JSON.stringify(latest, null, 2));
        return true;
      },
      async setPaused(id, paused) {
        await (paused ? performance.pauseExtension(id) : performance.resumeExtension(id));
        await query.refresh();
      },
    }),
  );
  const { renderOverlay, overlayIntent, copying, pendingExtensions } = useSyncExternalStore(
    actions.subscribe,
    actions.snapshot,
  );
  const [copied, setCopied] = useState(false);
  // The check mark confirms one copy, then the button offers to copy again.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);
  const [error, setError] = useState<PerformancePopoverContentProps["actionError"]>();
  useEffect(() => {
    if (!visible || snapshot === undefined) return;
    const controller = new AbortController();
    void actions.refreshOverlay(controller.signal);
    return () => controller.abort();
  }, [actions, visible, snapshot]);
  const run = (action: Promise<unknown>, source: NonNullable<typeof error>["source"] = "metrics") => {
    setError(undefined);
    action.catch((cause) => setError({ message: String(cause), source }));
  };

  return (
    <PerformancePopoverContent
      snapshot={snapshot}
      error={readError?.message}
      copied={copied}
      copying={copying}
      pendingExtensions={pendingExtensions}
      renderOverlay={{
        state: renderOverlay && { ...renderOverlay, enabled: overlayIntent ?? renderOverlay.enabled },
        pending: overlayIntent !== undefined,
        onEnabledChange: (enabled) => run(actions.setOverlay(enabled), "render-overlay"),
      }}
      actionError={error}
      onCopy={() =>
        run(
          actions.copy().then((accepted) => {
            if (accepted) setCopied(true);
          }),
        )
      }
      onDismissActionError={() => setError(undefined)}
      onPause={(installedExtensionId) => run(actions.setPaused(installedExtensionId, true))}
      onResume={(installedExtensionId) => run(actions.setPaused(installedExtensionId, false))}
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
