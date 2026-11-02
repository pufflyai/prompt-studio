import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import { PLATFORMS } from "../benchmarks/platforms";
import { useBenchmarks, useBenchmarksRefresh } from "../webview/client";
import { ReleasePending, SyncFailed } from "../webview/result-notices";
import { useSyncOnOpen } from "../webview/use-sync";
import { TrendsView } from "./trends-view";

export const TrendsPage = () => {
  const { client } = useBenchmarks();
  const sync = useSyncOnOpen();
  const [platforms, setPlatforms] = useState<string[]>(PLATFORMS.map((platform) => platform.id));
  const [chosenVersions, setChosenVersions] = useState<string[]>();
  const [showTable, setShowTable] = useState(false);
  useBenchmarksRefresh();
  // Every platform loads at once, so choosing platforms only changes which lines show.
  const trends = useCommandQuery({ queryKey: ["trends"], command: () => client.commands["benchmarks.trends"]() });
  if (trends.error)
    return (
      <AlertMessage status="error" title="Benchmark results could not be read">
        {trends.error.message}
      </AlertMessage>
    );
  const pending = trends.data?.pendingRelease;
  return (
    <TrendsView
      versions={trends.data?.versions ?? []}
      trends={trends.data?.trends ?? []}
      platforms={platforms}
      chosenVersions={chosenVersions}
      showTable={showTable}
      notice={
        <>
          {sync.error ? (
            <SyncFailed error={sync.error} syncedAt={sync.syncedAt} retrying={sync.retrying} onRetry={sync.retry} />
          ) : null}
          {pending ? <ReleasePending status={pending} /> : null}
        </>
      }
      onPlatformsChange={setPlatforms}
      onChosenVersionsChange={setChosenVersions}
      onShowTableChange={setShowTable}
    />
  );
};
