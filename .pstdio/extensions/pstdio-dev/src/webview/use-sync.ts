import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useBenchmarks } from "./client";

// Opening a page fetches results that finished since the last visit. The cache answers meanwhile,
// and the change event refreshes the page when the sync completes. A failed sync keeps the cache readable
// and reports when it last succeeded.
export const useSyncOnOpen = () => {
  const { client } = useBenchmarks();
  // Kept until a sync succeeds, so the alert and its Retry stay on screen while a retry runs.
  const [error, setError] = useState<string>();
  const sync = useMutation({
    mutationFn: () => client.commands["benchmarks.sync"](),
    onSuccess: () => setError(undefined),
    onError: (failure) => setError(failure.message),
  });
  const status = useCommandQuery({
    queryKey: ["sync-status"],
    command: () => client.commands["benchmarks.sync-status"](),
  });
  const { mutate } = sync;
  useEffect(() => mutate(), [mutate]);
  return {
    error,
    syncedAt: status.data?.syncedAt,
    retrying: sync.isPending,
    retry: () => mutate(),
  };
};
