import { Flex, Stack } from "@chakra-ui/react";
import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { AlertMessage } from "@pstdio/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { DEFAULT_PLATFORM, DEFAULT_SUITES } from "../benchmarks/platforms";
import { useBenchmarks, useBenchmarksRefresh, useOpenLink } from "../webview/client";
import { PageFrame } from "../webview/page-frame";
import { SyncFailed } from "../webview/result-notices";
import { useSyncOnOpen } from "../webview/use-sync";
import { RunForm, type RunRequest } from "./run-form";
import { RunList } from "./run-list";

export const RunsPage = () => {
  const { client } = useBenchmarks();
  const openLink = useOpenLink();
  const sync = useSyncOnOpen();
  const [request, setRequest] = useState<RunRequest>({
    commits: [],
    suites: DEFAULT_SUITES,
    platforms: [DEFAULT_PLATFORM],
  });
  useBenchmarksRefresh();
  const runs = useCommandQuery({ queryKey: ["runs"], command: () => client.commands["benchmarks.runs"]() });
  // Measured means results for every chosen suite on every chosen platform, so the list follows the form.
  const commits = useCommandQuery({
    queryKey: ["commits", request.platforms, request.suites],
    command: () => client.commands["benchmarks.commits"]({ platforms: request.platforms, suites: request.suites }),
  });
  const start = useMutation({
    mutationFn: (effective: RunRequest) => client.commands["benchmarks.start-run"](effective),
    onSuccess: () => setRequest((current) => ({ ...current, commits: [] })),
  });
  const cancel = useMutation({
    mutationFn: (runId: string) => client.commands["benchmarks.cancel-run"]({ runId }),
  });
  return (
    <PageFrame>
      {sync.error ? (
        <SyncFailed error={sync.error} syncedAt={sync.syncedAt} retrying={sync.retrying} onRetry={sync.retry} />
      ) : null}
      <Flex gap="lg" wrap="wrap" align="flex-start">
        <Stack flex="1 1 24rem" minW="0" maxW="lg">
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
        </Stack>
        <Stack flex="999 1 32rem" minW="0" gap="sm">
          {runs.error ? (
            <AlertMessage status="error" title="Runs could not be read">
              {runs.error.message}
            </AlertMessage>
          ) : null}
          {cancel.error ? (
            <AlertMessage status="error" title="The run could not be cancelled">
              {cancel.error.message}
            </AlertMessage>
          ) : null}
          <RunList
            runs={runs.data ?? []}
            cancelling={cancel.isPending ? cancel.variables : undefined}
            onCancel={(runId) => cancel.mutate(runId)}
            onOpen={openLink}
          />
        </Stack>
      </Flex>
    </PageFrame>
  );
};
