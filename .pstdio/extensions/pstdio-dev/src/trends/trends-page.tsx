import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import { DEFAULT_PLATFORM } from "../benchmarks/platforms";
import { useBenchmarks, useBenchmarksRefresh } from "../webview/client";
import { SyncStatus } from "../webview/sync-status";
import { useSyncOnOpen } from "../webview/use-sync";
import { type TrendsMode, TrendsView } from "./trends-view";

export const TrendsPage = () => {
  const { client } = useBenchmarks();
  const sync = useSyncOnOpen();
  const [platform, setPlatform] = useState(DEFAULT_PLATFORM);
  const [mode, setMode] = useState<TrendsMode>("versions");
  const [versionIndex, setVersionIndex] = useState<number>();
  const [selected, setSelected] = useState<string>();
  useBenchmarksRefresh();
  const trends = useCommandQuery({
    queryKey: ["trends", platform],
    command: () => client.commands["benchmarks.trends"]({ platform }),
  });
  if (trends.error)
    return (
      <AlertMessage status="error" title="Benchmark results could not be read">
        {trends.error.message}
      </AlertMessage>
    );
  const versions = trends.data?.versions ?? [];
  return (
    <TrendsView
      versions={versions}
      metrics={trends.data?.metrics ?? []}
      platform={platform}
      mode={mode}
      versionIndex={versionIndex ?? versions.length - 1}
      selected={selected}
      status={<SyncStatus sync={sync} />}
      onPlatformChange={setPlatform}
      onModeChange={setMode}
      onVersionChange={setVersionIndex}
      onSelect={setSelected}
    />
  );
};
