import type { QueryClient, QueryKey } from "@tanstack/query-core";
import type { createQueryLedger } from "./scoped-query-ledger";
import { shareQueryValue } from "./share-query-value";

const requireValue = <T>(value: T) => {
  if (value === undefined)
    throw new Error("A scoped query must return or accept a value; use null for an empty result.");
  return value;
};

export const createQueryReadOptions = <T>(input: {
  client: QueryClient;
  queryKey: QueryKey;
  ledger: ReturnType<typeof createQueryLedger<T>>;
  read(signal: AbortSignal): Promise<T>;
  assertActive(signal: AbortSignal): void;
}) => {
  const { client, queryKey, ledger } = input;
  return {
    queryKey,
    retry: false as const,
    staleTime: Infinity,
    gcTime: Infinity,
    // Fence at Query.setData itself: cancelling an already-resolved retryer is too late.
    structuralSharing: (previous: unknown, _next: unknown) => {
      const current = ledger.current();
      return current ? shareQueryValue(previous, current.data) : previous;
    },
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      for (;;) {
        const issued = ledger.revision();
        let value: T;
        try {
          value = requireValue(await input.read(signal));
        } catch (error) {
          signal.throwIfAborted();
          if (ledger.fail(issued, client.getQueryData<T>(queryKey), error)) throw error;
          if (!ledger.dirty()) return client.getQueryData<T>(queryKey)!;
          continue;
        }
        input.assertActive(signal);
        if (ledger.complete(issued, shareQueryValue(client.getQueryData<T>(queryKey), value))) return value;
        // Authoritative mutation/live data supersedes an older read without a second writer.
        if (!ledger.dirty()) return client.getQueryData<T>(queryKey)!;
      }
    },
  };
};
