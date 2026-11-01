import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { AlertMessage } from "@pstdio/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { DEFAULT_PLATFORM } from "../benchmarks/platforms";
import { useBenchmarks, useBenchmarksRefresh } from "../webview/client";
import { SyncFailed } from "../webview/result-notices";
import { useSyncOnOpen } from "../webview/use-sync";
import type { CommitOptionView } from "./commit-picker";
import { CompareView, type ResultFilter } from "./compare-view";

// Defaults to the two newest measured commits, so the page opens on a comparison when one exists. With one
// measured commit it shows that commit's own results.
const defaultPair = (commits: CommitOptionView[]) => {
  const measured = commits.filter((commit) => commit.measured);
  if (measured.length === 1) return { head: measured[0].sha };
  const [head, base] = measured.length >= 2 ? measured : commits;
  return { base: base?.sha, head: head?.sha };
};

export const ComparePage = () => {
  const { client } = useBenchmarks();
  const sync = useSyncOnOpen();
  const [platform, setPlatform] = useState(DEFAULT_PLATFORM);
  // A null base is a choice: read the head's own results.
  const [chosen, setChosen] = useState<{ base?: string | null; head?: string }>({});
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [selected, setSelected] = useState<string>();
  useBenchmarksRefresh();
  const commits = useCommandQuery({
    queryKey: ["commits", platform],
    command: () => client.commands["benchmarks.commits"]({ platforms: [platform] }),
  });
  const runs = useCommandQuery({ queryKey: ["runs"], command: () => client.commands["benchmarks.runs"]() });
  const fallback = defaultPair(commits.data ?? []);
  const base = chosen.base === null ? undefined : (chosen.base ?? fallback.base);
  const head = chosen.head ?? fallback.head;
  const comparison = useCommandQuery({
    queryKey: ["compare", base, head, platform],
    enabled: Boolean(head),
    command: () => client.commands["benchmarks.compare"]({ base: base ?? "", head: head ?? "", platform }),
  });
  const measure = useMutation({
    mutationFn: (shas: string[]) => client.commands["benchmarks.start-run"]({ commits: shas, platforms: [platform] }),
  });
  // Commits an open run on this platform is measuring, so Measure is not started twice.
  const measuring = (runs.data ?? [])
    .filter((run) => (run.status === "queued" || run.status === "running") && run.platforms.includes(platform))
    .flatMap((run) => run.commits.flatMap((commit) => (commit.sha ? [commit.sha] : [])));
  const error = commits.error ?? comparison.error;
  if (error)
    return (
      <AlertMessage status="error" title="Benchmark results could not be read">
        {error.message}
      </AlertMessage>
    );
  return (
    <CompareView
      commits={commits.data ?? []}
      base={base}
      head={head}
      platform={platform}
      rows={comparison.data?.rows ?? []}
      filter={filter}
      selected={selected}
      notice={
        <>
          {sync.error ? (
            <SyncFailed error={sync.error} syncedAt={sync.syncedAt} retrying={sync.retrying} onRetry={sync.retry} />
          ) : null}
          {measure.error ? (
            <AlertMessage status="error" title="The run could not be started">
              {measure.error.message}
            </AlertMessage>
          ) : null}
        </>
      }
      measuring={measure.isPending ? (measure.variables ?? []) : measuring}
      onBaseChange={(sha) => setChosen({ base: sha, head })}
      onBaseClear={() => setChosen({ base: null, head })}
      onHeadChange={(sha) => setChosen({ base: chosen.base === null ? null : base, head: sha })}
      onPlatformChange={setPlatform}
      onFilterChange={setFilter}
      onSelect={setSelected}
      onMeasure={(shas) => measure.mutate(shas)}
    />
  );
};
