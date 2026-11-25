import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useBenchmarks, useOpenLink } from "../webview/client";
import { healthAutomationChanged, healthChanged } from "./events";
import { HealthView } from "./health-view";

export const HealthPage = () => {
  const { client } = useBenchmarks();
  const queryClient = useQueryClient();
  const open = useOpenLink();
  const history = useCommandQuery({
    queryKey: ["release-health"],
    command: () => client.commands["release-health.history"](),
  });
  const refresh = useMutation({ mutationFn: () => client.commands["release-health.sync"]() });
  const requestRefresh = refresh.mutate;
  const resetRefresh = refresh.reset;
  useEffect(() => {
    if (history.data?.syncedAt) resetRefresh();
  }, [history.data?.syncedAt, resetRefresh]);
  useEffect(() => {
    const unsubscribe = client.events.subscribe(
      healthChanged,
      () => void queryClient.invalidateQueries({ queryKey: ["release-health"] }),
    );
    const unsubscribeAutomation = client.events.subscribe(
      healthAutomationChanged,
      () => void queryClient.invalidateQueries({ queryKey: ["release-health"] }),
    );
    requestRefresh();
    return () => {
      unsubscribe();
      unsubscribeAutomation();
    };
  }, [client, queryClient, requestRefresh]);
  return (
    <HealthView
      today={new Date().toISOString().slice(0, 10)}
      runs={history.data?.runs ?? []}
      pullRequestMergesDaily={history.data?.pullRequestMergesDaily ?? history.data?.pullRequestMerges}
      pullRequestMergesHourly={history.data?.pullRequestMergesHourly}
      pullRequestMergesError={history.data?.pullRequestMergesError}
      mergeThemes={history.data?.mergeThemes}
      mergeThemesError={history.data?.mergeThemesError}
      bugFailurePatterns={history.data?.bugFailurePatterns}
      bugFailurePatternsError={history.data?.bugFailurePatternsError}
      bugOriginCoverage={history.data?.bugOriginCoverage}
      publications={history.data?.publications}
      publicationsError={history.data?.publicationsError}
      syncedAt={history.data?.syncedAt}
      error={refresh.error?.message ?? history.error?.message ?? history.data?.error}
      refreshing={history.isLoading || refresh.isPending || Boolean(history.data?.syncing)}
      onRefresh={() => refresh.mutate()}
      onOpen={(url) => void open(url)}
    />
  );
};
