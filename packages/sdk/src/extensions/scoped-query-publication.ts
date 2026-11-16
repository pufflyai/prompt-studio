import type { QueryClient, QueryKey, QueryObserver } from "@tanstack/query-core";
import type { ScopedQuerySnapshot } from "./scoped-query";
import type { createQueryLedger } from "./scoped-query-ledger";
import { shareQueryValue } from "./share-query-value";

const sameSnapshot = <T>(a: ScopedQuerySnapshot<T>, b: ScopedQuerySnapshot<T>) =>
  a.data === b.data && a.loading === b.loading && a.fetching === b.fetching && a.error === b.error;

const restoreQueryError = (
  client: QueryClient,
  queryKey: QueryKey,
  expected: Error | undefined,
  actual: Error | null,
) => {
  if (actual === (expected ?? null)) return;
  client
    .getQueryCache()
    .find({ queryKey, exact: true })
    ?.setState({
      error: expected ?? null,
      status: expected ? "error" : "success",
      fetchStatus: "idle",
    });
};

export const createQueryPublication = <T>(input: {
  client: QueryClient;
  queryKey: QueryKey;
  observer: QueryObserver<T, Error>;
  ledger: ReturnType<typeof createQueryLedger<T>>;
  disposed(): boolean;
  running(): boolean;
  notify(): void;
  cancelRequest(): void;
  resume(): void;
}) => {
  const { client, queryKey, observer, ledger } = input;
  let snapshotRevision = ledger.revision();
  let snapshot: ScopedQuerySnapshot<T> = { data: client.getQueryData<T>(queryKey), loading: false, fetching: false };
  const publish = () => {
    if (input.disposed()) return;
    const result = observer.getCurrentResult();
    const stale = ledger.dirty();
    const accepted = ledger.current();
    if (accepted) restoreQueryError(client, queryKey, accepted.error, result.error);
    const selected = accepted ?? (stale ? snapshot : result);
    const fetching = result.isFetching || (ledger.dirty() && input.running());
    const next = {
      data: selected.data,
      loading: selected.data === undefined && fetching,
      fetching,
      error: selected.error ?? undefined,
    };
    // A successful new revision must wake lifetime adapters even when its data structurally shares every value.
    const revision = !stale && !fetching ? ledger.revision() : snapshotRevision;
    if (sameSnapshot(next, snapshot) && revision === snapshotRevision) return;
    snapshotRevision = revision;
    snapshot = next;
    input.notify();
  };
  return {
    accept(value: T) {
      if (input.disposed()) return;
      if (value === undefined) throw new Error("A scoped query must accept a value; use null for an empty result.");
      const accepted = ledger.accept(shareQueryValue(client.getQueryData<T>(queryKey), value));
      input.resume();
      // Cancel work and guard cache publication even if its retryer has already resolved.
      input.cancelRequest();
      client.setQueryData(queryKey, accepted.data);
      observer.updateResult();
      publish();
    },
    reportError(cause: unknown) {
      if (input.disposed()) return;
      const accepted = ledger.accept(snapshot.data, cause instanceof Error ? cause : new Error(String(cause)));
      input.cancelRequest();
      client.getQueryCache().find({ queryKey, exact: true })?.setState({
        error: accepted.error,
        status: "error",
        fetchStatus: "idle",
      });
      observer.updateResult();
      publish();
    },
    publish,
    getSnapshot: () => snapshot,
    clear: () => {
      snapshot = { data: undefined, loading: false, fetching: false };
    },
  };
};
