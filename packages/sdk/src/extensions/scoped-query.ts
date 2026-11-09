import { hashKey, QueryClient } from "@tanstack/query-core";
import { runQueryCleanup } from "./query-cleanup";
import { matchesQueryDependency, type QueryDependency } from "./query-dependency";
import { createQueryOwner } from "./scoped-query-owner";
import type { WebviewExtensionEvent } from "./webview-events";

export interface QueryScope {
  runtimeId: string;
  accountId?: string;
  accountOrigin?: string;
  projectId?: string;
  extensionId: string;
}

export interface ScopedQueryDescriptor<T> {
  id: string;
  params?: unknown;
  resourceKey?: string;
  dependsOn?: readonly string[];
  dependency?: QueryDependency;
  read(signal: AbortSignal): Promise<T> | T;
  /** Must observe changes before the initial read. Detaches with the last active observer. */
  subscribe?(invalidate: () => void): () => void;
}

export interface ScopedQuerySnapshot<T> {
  data: T | undefined;
  loading: boolean;
  fetching: boolean;
  error?: Error;
}

export const scopedQueryKey = (
  scope: QueryScope,
  input: Pick<ScopedQueryDescriptor<unknown>, "id" | "params" | "resourceKey">,
) =>
  [
    "pstdio",
    scope.runtimeId,
    scope.accountId ?? null,
    scope.accountOrigin ?? null,
    scope.projectId ?? null,
    scope.extensionId,
    input.id,
    input.resourceKey ?? null,
    input.params ?? null,
  ] as const;

export type ScopedQuery<T> = ReturnType<typeof createQueryOwner<T>>;

/** One owner per identity. Share the existing client within a root; never share accounts accidentally. */
export const createScopedQueryClient = (
  initialScope: QueryScope,
  input: {
    client?: QueryClient;
    maxInactive?: number;
    subscribe?: (listener: (event: WebviewExtensionEvent) => void) => () => void;
  } = {},
) => {
  const client = input.client ?? new QueryClient();
  let baseScope = { ...initialScope };
  const maxInactive = input.maxInactive ?? 128;
  // TanStack cancellation settles before an uncooperative command actually exits.
  // Keep that child's admission barrier across acceptance, eviction and reopening.
  const children = new Map<string, Promise<void>>();
  const readChild = async <T>(key: string, read: ScopedQueryDescriptor<T>["read"], signal: AbortSignal) => {
    const previous = children.get(key);
    const settled = Promise.withResolvers<void>();
    children.set(key, settled.promise);
    try {
      if (previous) await previous;
      signal.throwIfAborted();
      return await read(signal);
    } finally {
      settled.resolve();
      if (children.get(key) === settled.promise) children.delete(key);
    }
  };
  const entries = new Map<
    string,
    {
      owner: unknown;
      active(): boolean;
      dispose(): void;
      isDisposed(): boolean;
      updateRead(descriptor: unknown): void;
      scope: QueryScope;
      watches: Map<string, { ids: readonly string[]; dependency: QueryDependency }>;
      invalidate(): void;
    }
  >();
  let disposed = false;
  const retirementListeners = new Set<() => void>();
  const notifyRetirement = () => runQueryCleanup([...retirementListeners]);
  const trim = (protectedKey?: string) => {
    const inactive = [...entries].filter(([key, entry]) => key !== protectedKey && !entry.active());
    const retired = inactive.slice(0, Math.max(0, inactive.length - maxInactive));
    for (const [key] of retired) entries.delete(key);
    if (retired.length) runQueryCleanup([...retired.map(([, entry]) => entry.dispose), notifyRetirement]);
  };
  const invalidate = (event: WebviewExtensionEvent) => {
    const affected = [...entries.values()].filter((entry) =>
      [...entry.watches.values()].some(
        (watch) =>
          (event.type === "reset" || watch.ids.includes(event.id)) &&
          matchesQueryDependency(event, {
            projectId: entry.scope.projectId,
            extensionId: entry.scope.extensionId,
            ...watch.dependency,
          }),
      ),
    );
    runQueryCleanup(affected.map((entry) => entry.invalidate));
  };
  const stop = input.subscribe?.(invalidate);
  const forScope = (overrides: Partial<QueryScope>) => ({
    query<T>(descriptor: ScopedQueryDescriptor<T>) {
      const scope = { ...baseScope, ...overrides };
      if (disposed) throw new Error("Query client is disposed");
      const key = scopedQueryKey(scope, descriptor);
      const hash = hashKey(key);
      const entry = entries.get(hash);
      const watch = { ids: descriptor.dependsOn ?? [], dependency: descriptor.dependency ?? {} };
      if (entry && !entry.isDisposed()) {
        entry.updateRead(descriptor);
        entry.watches.set(hashKey([watch.ids, watch.dependency]), watch);
        entries.delete(hash);
        entries.set(hash, entry);
        return entry.owner as ScopedQuery<T>;
      }
      let current = descriptor;
      const owner = createQueryOwner(
        client,
        key,
        { ...descriptor, read: (signal) => readChild(hash, current.read, signal) },
        () => trim(),
      );
      const disposeOwner = owner.dispose;
      owner.dispose = () => {
        const current = entries.get(hash)?.owner === owner;
        if (current) entries.delete(hash);
        runQueryCleanup([
          disposeOwner,
          () => {
            if (current && !disposed) notifyRetirement();
          },
        ]);
      };
      entries.set(hash, {
        owner,
        updateRead: (next) => {
          current = next as ScopedQueryDescriptor<T>;
        },
        active: owner.active,
        dispose: owner.dispose,
        isDisposed: owner.isDisposed,
        scope,
        watches: new Map([[hashKey([watch.ids, watch.dependency]), watch]]),
        invalidate: owner.invalidate,
      });
      trim(hash);
      return owner;
    },
  });
  const clearScope = (scope: Partial<QueryScope>) => {
    const retired = [...entries].filter(([, entry]) =>
      Object.entries(scope).every(([field, value]) => entry.scope[field as keyof QueryScope] === value),
    );
    // Notify only after the old identities are gone; subscribers may bind a new authority synchronously.
    for (const [key] of retired) entries.delete(key);
    if (retired.length) runQueryCleanup([...retired.map(([, entry]) => entry.dispose), notifyRetirement]);
  };
  return {
    ...forScope({}),
    forScope,
    invalidate,
    clearScope,
    /** Cheap revocation/eviction observation, including while optional readers are detached. */
    subscribeRetirement(listener: () => void) {
      if (disposed) throw new Error("Query client is disposed");
      retirementListeners.add(listener);
      return () => {
        retirementListeners.delete(listener);
      };
    },
    setAuthority(next: Pick<QueryScope, "accountId" | "accountOrigin">) {
      if (disposed || (next.accountId === baseScope.accountId && next.accountOrigin === baseScope.accountOrigin))
        return;
      baseScope = { ...baseScope, accountId: next.accountId, accountOrigin: next.accountOrigin };
      clearScope({});
    },
    inspect: () => ({ active: [...entries.values()].filter((entry) => entry.active()).length, retained: entries.size }),
    isDisposed: () => disposed,
    dispose() {
      if (disposed) return;
      disposed = true;
      const retiring = [...entries.values()];
      entries.clear();
      try {
        runQueryCleanup([() => stop?.(), ...retiring.map((entry) => entry.dispose), notifyRetirement]);
      } finally {
        retirementListeners.clear();
      }
    },
  };
};

export type ScopedQueryClient = ReturnType<typeof createScopedQueryClient>;

export { isCancelledError as isScopedQueryCancellation } from "@tanstack/query-core";
