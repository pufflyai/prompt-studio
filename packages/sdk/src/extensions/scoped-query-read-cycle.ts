import type { QueryClient, QueryKey } from "@tanstack/query-core";
import type { createQueryLedger } from "./scoped-query-ledger";
import type { createQueryReadOptions } from "./scoped-query-read-options";

/** Preserve both queryFn and cache-commit revision fences while yielding repeated background reads. */
export const runScopedQueryRead = async <T>(input: {
  client: QueryClient;
  queryKey: QueryKey;
  options: ReturnType<typeof createQueryReadOptions<T>>;
  ledger: ReturnType<typeof createQueryLedger<T>>;
  signal: AbortSignal;
  assertOpen(): void;
  needsFollowUp(error?: unknown): boolean;
  beforeRepeat(signal: AbortSignal): Promise<void>;
}) => {
  const current = () => {
    input.assertOpen();
    input.signal.throwIfAborted();
  };
  const repeat = async () => {
    await input.client.invalidateQueries({ queryKey: input.queryKey, exact: true, refetchType: "none" });
    await input.beforeRepeat(input.signal);
    current();
  };
  for (;;) {
    current();
    try {
      const value = await input.client.fetchQuery<T>(input.options);
      current();
      if (!input.needsFollowUp()) return input.ledger.resolve(value);
      await repeat();
      if (!input.needsFollowUp()) return input.ledger.resolve(value);
    } catch (error) {
      current();
      if (!input.needsFollowUp(error)) return input.ledger.recover(error);
      await repeat();
      if (!input.needsFollowUp(error)) return input.ledger.recover(error);
    }
  }
};
