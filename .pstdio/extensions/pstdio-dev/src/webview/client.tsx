import type { createWebviewClient, GuestHost } from "@pstdio/sdk/extensions";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect } from "react";
import type { benchmarkCommands } from "../benchmarks/commands";
import { benchmarksChanged } from "../benchmarks/events";

export type BenchmarksClient = ReturnType<typeof createWebviewClient<typeof benchmarkCommands>>;
interface BenchmarksContextValue {
  host: GuestHost;
  client: BenchmarksClient;
}
export const BenchmarksContext = createContext<BenchmarksContextValue | null>(null);

export const useBenchmarks = () => {
  const value = useContext(BenchmarksContext);
  if (!value) throw new Error("Performance pages need the extension host.");
  return value;
};

/** Refetches when a sync or run reports new results, instead of polling. */
export const useBenchmarksRefresh = () => {
  const { client } = useBenchmarks();
  const queryClient = useQueryClient();
  useEffect(
    () => client.events.subscribe(benchmarksChanged, () => void queryClient.invalidateQueries()),
    [client, queryClient],
  );
};

// A link inside the sandboxed webview would open a sandboxed tab, so the host opens it.
export const useOpenLink = () => {
  const { host } = useBenchmarks();
  return (href: string) => host.call("navigation.open", { target: { kind: "href", href } });
};
