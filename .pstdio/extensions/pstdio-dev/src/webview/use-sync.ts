import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useBenchmarks } from "./client";

// Opening a page fetches results that finished since the last visit. The cache answers meanwhile,
// and the change event refreshes the page when the sync completes. A failed sync keeps the cache readable
// and reports when it last succeeded.
export const useSyncOnOpen = () => {
  const { client } = useBenchmarks();
  const sync = useMutation({ mutationFn: () => client.commands["benchmarks.sync"]() });
  const status = useCommandQuery({
    queryKey: ["sync-status"],
    command: () => client.commands["benchmarks.sync-status"](),
  });
  const { mutate } = sync;
  useEffect(() => mutate(), [mutate]);
  return {
    error: sync.error?.message,
    syncedAt: status.data?.syncedAt,
    retrying: sync.isPending,
    retry: () => mutate(),
  };
};
