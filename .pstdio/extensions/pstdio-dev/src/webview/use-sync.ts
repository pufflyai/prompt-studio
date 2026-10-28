import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useBenchmarks } from "./client";

// Opening a page fetches results that finished since the last visit. The cache answers meanwhile,
// and the change event refreshes the page when the sync completes.
export const useSyncOnOpen = () => {
  const { client } = useBenchmarks();
  const sync = useMutation({ mutationFn: () => client.commands["benchmarks.sync"]() });
  const { mutate } = sync;
  useEffect(() => mutate(), [mutate]);
  return sync;
};
