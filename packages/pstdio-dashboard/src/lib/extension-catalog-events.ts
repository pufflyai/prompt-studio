import { type QueryChangeEnvelope, viewDataEvents } from "@pstdio/sdk/extensions";
import { hashKey } from "@tanstack/react-query";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { CollectionChange, RuntimeCollections, SyncedRow } from "./sync/collections";

const projectScope = (row: SyncedRow) =>
  row.scope_type === "project" && typeof row.scope_id === "string" ? row.scope_id : undefined;

type CatalogScope = Pick<QueryChangeEnvelope, "projectId" | "extensionId">;
const scopeKey = (scope: CatalogScope) => JSON.stringify([scope.projectId, scope.extensionId]);

const catalogChangeOwners = (
  change?: CollectionChange,
  extensionOfInstance?: (row: SyncedRow) => string | undefined,
) => {
  const projects = new Map<string, CatalogScope>();
  if (!change || !["installed_extension_sources", "extension_instances"].includes(change.table)) return projects;
  for (const { value, previousValue } of change.changes) {
    if (value && previousValue && hashKey([value]) === hashKey([previousValue])) continue;
    for (const row of [previousValue, value]) {
      if (!row) continue;
      const id = change.table === "extension_instances" ? extensionOfInstance?.(row) : row.extension_id;
      const scope = {
        projectId: change.table === "extension_instances" ? projectScope(row) : undefined,
        ...(typeof id === "string" ? { extensionId: canonicalExtensionId(id) } : {}),
      };
      projects.set(scopeKey(scope), scope);
    }
  }
  return projects;
};

export const catalogChangeScopes = (change?: CollectionChange) =>
  new Set([...catalogChangeOwners(change).values()].map((scope) => scope.projectId));

/** One cheap runtime feed marks inactive catalogs stale; hidden catalogs perform no reads. */
export const subscribeExtensionCatalogChanges = (
  owner: RuntimeCollections,
  publish: (event: QueryChangeEnvelope & { id: string }) => void,
) => {
  const pending = new Map<string, CatalogScope>();
  let scheduled = false;
  let closed = false;
  const stop = owner.subscribeCollections((change) => {
    const scopes = catalogChangeOwners(change, (row) => {
      const source = owner.getCollection("installed_extension_sources").get(String(row.installed_extension_id));
      return typeof source?.extension_id === "string" ? source.extension_id : undefined;
    });
    for (const [key, scope] of scopes) pending.set(key, scope);
    if (!pending.size || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (closed || owner.isDisposed()) return;
      const projects = pending.has(scopeKey({})) ? [{ projectId: undefined }] : [...pending.values()];
      pending.clear();
      for (const scope of projects) publish({ id: viewDataEvents.extensionCatalogChanged.id, ...scope });
    });
  });
  return () => {
    closed = true;
    pending.clear();
    stop();
  };
};
