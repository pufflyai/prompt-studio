import { Flex, Stack } from "@chakra-ui/react";
import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { AlertMessage } from "@pstdio/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { DEFAULT_PLATFORM, DEFAULT_SUITES } from "../benchmarks/platforms";
import { useBenchmarks, useBenchmarksRefresh, useOpenLink } from "../webview/client";
import { PageFrame } from "../webview/page-frame";
import { SyncStatus } from "../webview/sync-status";
import { useSyncOnOpen } from "../webview/use-sync";
import { RunForm, type RunRequest } from "./run-form";
import { RunList } from "./run-list";

const quickCommits = (commits: { ref: string }[] = []) => {
  const releases = commits.filter((commit) => commit.ref.startsWith("pstdio@"));
  return [
    ...(releases[0] ? [{ label: "Latest release", ref: releases[0].ref }] : []),
    ...(releases[1] ? [{ label: "Previous release", ref: releases[1].ref }] : []),
    { label: "main", ref: "main" },
  ];
};

export const RunsPage = () => {
  const { client } = useBenchmarks();
  const openLink = useOpenLink();
  const sync = useSyncOnOpen();
  const [request, setRequest] = useState<RunRequest>({
    commits: [],
    suites: DEFAULT_SUITES,
    platforms: [DEFAULT_PLATFORM],
    samples: 10,
  });
  useBenchmarksRefresh();
  const runs = useCommandQuery({ queryKey: ["runs"], command: () => client.commands["benchmarks.runs"]() });
  const commits = useCommandQuery({
    queryKey: ["commits", DEFAULT_PLATFORM],
    command: () => client.commands["benchmarks.commits"]({ platform: DEFAULT_PLATFORM }),
  });
  const start = useMutation({
    mutationFn: () => client.commands["benchmarks.start-run"](request),
    onSuccess: () => setRequest((current) => ({ ...current, commits: [] })),
  });
  const cancel = useMutation({
    mutationFn: (runId: string) => client.commands["benchmarks.cancel-run"]({ runId }),
  });
  return (
    <PageFrame toolbar={<SyncStatus sync={sync} />}>
      <Flex gap="lg" wrap="wrap" align="flex-start">
        <Stack flex="1 1 24rem" minW="0" maxW="lg">
          <RunForm
            value={request}
            quick={quickCommits(commits.data)}
            pending={start.isPending}
            error={start.error?.message}
            onChange={setRequest}
            onStart={() => start.mutate()}
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
