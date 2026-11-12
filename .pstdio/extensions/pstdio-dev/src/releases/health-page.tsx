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
      runs={history.data?.runs ?? []}
      syncedAt={history.data?.syncedAt}
      error={refresh.error?.message ?? history.error?.message ?? history.data?.error}
      refreshing={history.isLoading || refresh.isPending || Boolean(history.data?.syncing)}
      onRefresh={() => refresh.mutate()}
      onOpen={(url) => void open(url)}
    />
  );
};
