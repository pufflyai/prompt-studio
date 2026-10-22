import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { AlertMessage } from "@pstdio/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { DEFAULT_PLATFORM, DEFAULT_SUITES } from "../benchmarks/platforms";
import { useBenchmarks, useBenchmarksRefresh, useOpenPage } from "../webview/client";
import { SyncStatus } from "../webview/sync-status";
import { useSyncOnOpen } from "../webview/use-sync";
import type { CommitOptionView } from "./commit-picker";
import { CompareView, type ResultFilter, RunAction } from "./compare-view";

// Defaults to the two newest measured commits, so the page opens on a comparison when one exists.
const defaultPair = (commits: CommitOptionView[]) => {
  const measured = commits.filter((commit) => commit.measured);
  const [head, base] = measured.length >= 2 ? measured : commits;
  return { base: base?.sha, head: head?.sha };
};

export const ComparePage = () => {
  const { client } = useBenchmarks();
  const openPage = useOpenPage();
  const sync = useSyncOnOpen();
  const [platform, setPlatform] = useState(DEFAULT_PLATFORM);
  const [chosen, setChosen] = useState<{ base?: string; head?: string }>({});
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [selected, setSelected] = useState<string>();
  useBenchmarksRefresh();
  const commits = useCommandQuery({
    queryKey: ["commits", platform],
    command: () => client.commands["benchmarks.commits"]({ platform }),
  });
  const fallback = defaultPair(commits.data ?? []);
  const base = chosen.base ?? fallback.base;
  const head = chosen.head ?? fallback.head;
  const comparison = useCommandQuery({
    queryKey: ["compare", base, head, platform],
    enabled: Boolean(base && head),
    command: () => client.commands["benchmarks.compare"]({ base: base ?? "", head: head ?? "", platform }),
  });
  const run = useMutation({
    mutationFn: (commits: string[]) =>
      client.commands["benchmarks.start-run"]({ commits, suites: DEFAULT_SUITES, platforms: [platform] }),
  });
  const error = commits.error ?? comparison.error;
  if (error)
    return (
      <AlertMessage status="error" title="Benchmark results could not be read">
        {error.message}
      </AlertMessage>
    );
  const hasResults = Boolean(comparison.data?.hasBase && comparison.data.hasHead);
  return (
    <CompareView
      commits={commits.data ?? []}
      base={base}
      head={head}
      platform={platform}
      rows={comparison.data?.rows ?? []}
      filter={filter}
      selected={selected}
      status={<SyncStatus sync={sync} />}
      runAction={
        <RunAction
          label={hasResults ? "Run again" : "Run benchmarks"}
          pending={run.isPending}
          startedRunId={run.data?.runId}
          error={run.error?.message}
          disabled={!base || !head}
          onRun={() => {
            if (base && head) run.mutate([base, head]);
          }}
          onOpenRuns={() => openPage("runs")}
        />
      }
      onBaseChange={(sha) => setChosen({ base: sha, head })}
      onHeadChange={(sha) => setChosen({ base, head: sha })}
      onPlatformChange={setPlatform}
      onFilterChange={setFilter}
      onSelect={setSelected}
    />
  );
};
