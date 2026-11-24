import { type ResourceAnchorPage, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ResourceLinkCandidate, ResourceLinkChangePreview, ResourceLinksService } from "./resource-links-types";

export interface RelatedResourceRow {
  edge: ResourceAnchorPage["items"][number];
  candidate: ResourceLinkCandidate;
  incoming: boolean;
  pending?: "pending" | "unconfirmed";
}

const noChanges: readonly ResourceLinkChangePreview[] = [];
const getNoChanges = () => noChanges;
const subscribeToNoChanges = () => () => {};

const edgeKey = (source: ResourceRef, target: ResourceRef) =>
  JSON.stringify([resourceKey(source), resourceKey(target)]);

type PendingLink = { edge: RelatedResourceRow["edge"]; status: NonNullable<RelatedResourceRow["pending"]> };

const indexPendingLinks = (changes: readonly ResourceLinkChangePreview[]) => {
  const pending = new Map<string, PendingLink | null>();
  for (const { change, status } of changes) {
    if (status === "rejected") continue;
    if (change.kind === "remove") {
      for (const target of change.targets) pending.set(edgeKey(change.source, target), null);
    } else {
      for (const target of change.targets)
        pending.set(edgeKey(change.source, target), {
          edge: { source: change.source, target },
          status: status === "unknown" || status === "unconfirmed" ? "unconfirmed" : "pending",
        });
    }
  }
  return pending;
};

export const projectResourceLinkRows = (
  rows: RelatedResourceRow[],
  changes: readonly ResourceLinkChangePreview[],
  resource?: ResourceRef,
) => {
  if (!changes.length) return rows;
  const pending = indexPendingLinks(changes);
  const projected = rows.flatMap((row) => {
    const key = edgeKey(row.edge.source, row.edge.target);
    const operation = pending.get(key);
    pending.delete(key);
    if (operation === undefined) return [row];
    if (operation === null) return [];
    const target = { ...row.edge.target, role: operation.edge.target.role };
    return [{ ...row, edge: { ...row.edge, target } }];
  });
  if (!resource) return projected;
  const resourceId = resourceKey(resource);
  let additions = 0;
  for (const operation of pending.values()) {
    if (!operation) continue;
    const { edge, status } = operation;
    const incoming = resourceKey(edge.source) !== resourceId;
    if (incoming && resourceKey(edge.target) !== resourceId) continue;
    projected.push({ edge, incoming, pending: status, candidate: { resource: incoming ? edge.source : edge.target } });
    if (++additions === 25) break;
  }
  return projected;
};

export const useResourceLinkRows = (service: ResourceLinksService, resource: ResourceRef, cursor?: string) => {
  const [rows, setRows] = useState<RelatedResourceRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const changes = useSyncExternalStore(
    service.changes?.subscribe ?? subscribeToNoChanges,
    service.changes?.getSnapshot ?? getNoChanges,
    getNoChanges,
  );

  useEffect(() => {
    void revision;
    const key = resourceKey(resource);
    let current: AbortController | undefined;
    let latest: Promise<void> | undefined;
    let closed = false;
    const refresh = (operationSignal?: AbortSignal): Promise<void> => {
      if (closed || operationSignal?.aborted) return Promise.resolve();
      current?.abort();
      const controller = new AbortController();
      current = controller;
      const signal = operationSignal ? AbortSignal.any([operationSignal, controller.signal]) : controller.signal;
      setLoading(true);
      setReadError(undefined);
      const cancelled = Promise.withResolvers<void>();
      const detach = () => cancelled.resolve();
      signal.addEventListener("abort", detach, { once: true });

      const read = Promise.resolve()
        .then(() => {
          signal.throwIfAborted();
          return service.list({ resource, direction: "both", limit: 25, cursor });
        })
        .then(async (page) => {
          if (signal.aborted) return;
          const refs = page.items.map((edge) => (resourceKey(edge.source) === key ? edge.target : edge.source));
          const resolved = refs.length ? await service.resolve(refs, signal) : [];
          if (signal.aborted) return;
          const candidates = new Map(resolved.map((item) => [resourceKey(item.resource), item]));
          setRows(
            page.items.map((edge, index) => ({
              edge,
              incoming: resourceKey(edge.source) !== key,
              candidate: candidates.get(resourceKey(refs[index]!)) ?? { resource: refs[index]! },
            })),
          );
          setNextCursor(page.nextCursor);
        })
        .catch((error: unknown) => {
          if (signal.aborted) return;
          setReadError(error instanceof Error ? error.message : String(error));
          throw error;
        })
        .finally(() => {
          if (!closed && current === controller) setLoading(false);
        });
      latest = Promise.race([read, cancelled.promise])
        .then(() => {
          if (!closed && current !== controller && !operationSignal?.aborted) return latest;
        })
        .finally(() => signal.removeEventListener("abort", detach));
      return latest;
    };
    const refreshInBackground = () => void refresh().catch(() => {});
    const unobserve = service.changes?.observe(refresh);
    const unsubscribe = service.subscribe(refreshInBackground);
    refreshInBackground();
    return () => {
      closed = true;
      current?.abort();
      unsubscribe();
      unobserve?.();
    };
  }, [resource, service, cursor, revision]);

  return {
    rows: projectResourceLinkRows(rows, changes, cursor === undefined ? resource : undefined),
    changes,
    nextCursor,
    loading,
    readError,
    refresh: () => setRevision((value) => value + 1),
  };
};
