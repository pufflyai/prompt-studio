import { viewDataEvents } from "@pstdio/sdk/extensions";
import type { CollectionChange, RuntimeCollections, SyncedRow } from "./sync/collections";

const projectScope = (row: SyncedRow) =>
  row.scope_type === "project" && typeof row.scope_id === "string" ? row.scope_id : undefined;

export const catalogChangeScopes = (change?: CollectionChange) => {
  const projects = new Set<string | undefined>();
  if (!change || !["installed_extension_sources", "extension_instances"].includes(change.table)) return projects;
  for (const { value, previousValue } of change.changes) {
    if (
      value &&
      previousValue &&
      Object.keys({ ...value, ...previousValue }).every((key) => Object.is(value[key], previousValue[key]))
    )
      continue;
    for (const row of [previousValue, value])
      if (row) projects.add(change.table === "extension_instances" ? projectScope(row) : undefined);
  }
  return projects;
};

/** One cheap runtime feed marks inactive catalogs stale; hidden catalogs perform no reads. */
export const subscribeExtensionCatalogChanges = (
  owner: RuntimeCollections,
  publish: (event: { id: string; projectId?: string }) => void,
) => {
  const pending = new Set<string | undefined>();
  let scheduled = false;
  let closed = false;
  const stop = owner.subscribeCollections((change) => {
    for (const projectId of catalogChangeScopes(change)) pending.add(projectId);
    if (!pending.size || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (closed || owner.isDisposed()) return;
      const projects = pending.has(undefined) ? [undefined] : [...pending];
      pending.clear();
      for (const projectId of projects) publish({ id: viewDataEvents.extensionCatalogChanged.id, projectId });
    });
  });
  return () => {
    closed = true;
    pending.clear();
    stop();
  };
};
