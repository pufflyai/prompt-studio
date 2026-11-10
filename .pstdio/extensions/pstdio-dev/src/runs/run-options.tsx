import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { AlertMessage } from "@pstdio/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { DEFAULT_PLATFORM, DEFAULT_SUITES, runsOn, SUITES } from "../benchmarks/platforms";
import { useBenchmarks, useBenchmarksRefresh } from "../webview/client";
import { PageFrame } from "../webview/page-frame";
import { RunForm, type RunRequest } from "./run-form";

export const RunOptions = () => {
  const { client } = useBenchmarks();
  const [request, setRequest] = useState<RunRequest>({
    commits: [],
    suites: DEFAULT_SUITES,
    platforms: [DEFAULT_PLATFORM],
  });
  useBenchmarksRefresh();
  // Measured means every chosen suite that can run on a chosen platform has results.
  const suites = SUITES.filter(
    (suite) => request.suites.includes(suite.id) && request.platforms.some((platform) => runsOn(suite, platform)),
  ).map((suite) => suite.id);
  const commits = useCommandQuery({
    queryKey: ["commits", request.platforms, suites],
    command: () => client.commands["benchmarks.commits"]({ platforms: request.platforms, suites }),
  });
  const start = useMutation({
    mutationFn: (effective: RunRequest) => client.commands["benchmarks.start-run"](effective),
    onSuccess: () => setRequest((current) => ({ ...current, commits: [] })),
  });
  return (
    <PageFrame>
      {start.data?.dispatched && !start.data.runId ? (
        <AlertMessage status="info" title="The run started">
          GitHub has not listed it yet. It appears in Runs after the next sync.
        </AlertMessage>
      ) : null}
      {start.data && !start.data.dispatched ? (
        <AlertMessage status="info" title="Nothing new to measure">
          Every commit already has results for these suites and platforms. Compare them instead.
        </AlertMessage>
      ) : null}
      <RunForm
        value={request}
        refs={(commits.data ?? []).map((commit) => ({
          ref: commit.ref || commit.sha,
          sha: commit.sha,
          measured: commit.measured,
        }))}
        pending={start.isPending}
        error={start.error?.message ?? commits.error?.message}
        onChange={setRequest}
        onStart={(effective) => start.mutate(effective)}
      />
    </PageFrame>
  );
};
