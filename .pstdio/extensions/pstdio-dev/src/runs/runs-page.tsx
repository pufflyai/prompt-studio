import { Stack } from "@chakra-ui/react";
import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { AlertMessage } from "@pstdio/ui";
import { useMutation } from "@tanstack/react-query";
import { useBenchmarks, useBenchmarksRefresh, useOpenLink } from "../webview/client";
import { PageFrame } from "../webview/page-frame";
import { SyncFailed } from "../webview/result-notices";
import { useSyncOnOpen } from "../webview/use-sync";
import { RunList } from "./run-list";

export const RunsPage = () => {
  const { client } = useBenchmarks();
  const openLink = useOpenLink();
  const sync = useSyncOnOpen();
  useBenchmarksRefresh();
  const runs = useCommandQuery({ queryKey: ["runs"], command: () => client.commands["benchmarks.runs"]() });
  const cancel = useMutation({
    mutationFn: (runId: string) => client.commands["benchmarks.cancel-run"]({ runId }),
  });
  return (
    <PageFrame>
      {sync.error ? (
        <SyncFailed error={sync.error} syncedAt={sync.syncedAt} retrying={sync.retrying} onRetry={sync.retry} />
      ) : null}
      <Stack minW="0" gap="sm">
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
    </PageFrame>
  );
};
