import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedRecord } from "pstdio-sync/records";
import { jsonBatches } from "./json-batches";
import type { OrderedJournal } from "./ordered-journal";
import { orderedNumber } from "./ordered-number-values";
import type { OrderedTransaction } from "./ordered-sql";

/** Number claims couple otherwise independent records. Include pending claimants before
 * checking a repair's author-group budget. Shown aliases retain original claims after
 * optimistic renumbering; settled alias history never loads author payloads. */
export const pendingOrderedNumberPeers = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  ids: string[],
  views: Map<string, OrderedRecord>,
) => {
  const included = new Set(ids);
  const keys = [
    ...new Map(
      [...views.values()].flatMap((record) => {
        const number = orderedNumber(record);
        if (!number) return [];
        const key = {
          extension_id: number.extensionId,
          kind: number.kind,
          shorthand: `${number.prefix}-${number.value}`,
        };
        return [[JSON.stringify(key), key] as const];
      }),
    ).values(),
  ];
  const peers = new Set<string>();
  for (const batch of jsonBatches(keys)) {
    // Aliases are found by shorthand first, so the work stays bounded by the requested keys. Joining
    // identities on kind alone first multiplies every requested key by every resource of that kind.
    const result = await tx.execute(sql`WITH requested AS (
      SELECT DISTINCT extension_id, kind, shorthand FROM jsonb_to_recordset(${batch}::jsonb)
        AS k(extension_id text, kind text, shorthand text)
    ), alias_matches AS MATERIALIZED (
      SELECT a.resource_id, r.extension_id, r.kind FROM requested r
        INNER JOIN storage_resource_aliases a
          ON a.workbench_id = ${owner.workbenchId} AND a.shorthand = r.shorthand
    ) SELECT candidate.resource_id FROM (
      SELECT i.resource_id FROM storage_resource_identities i
        INNER JOIN requested USING(extension_id, kind, shorthand)
        WHERE i.workbench_id = ${owner.workbenchId}
      UNION ALL
      SELECT m.resource_id FROM alias_matches m
        INNER JOIN storage_resource_identities i
          ON i.workbench_id = ${owner.workbenchId} AND i.resource_id = m.resource_id
            AND i.extension_id = m.extension_id AND i.kind = m.kind
    ) candidate
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb) included(id)
      WHERE included.id = candidate.resource_id)
      AND EXISTS (SELECT 1 FROM storage_ordered_touches t
        WHERE t.workbench_id = ${owner.workbenchId} AND t.extension_id = ${owner.extensionId}
          AND t.record_id = candidate.resource_id)
    LIMIT 100`);
    for (const row of result.rows as { resource_id: string }[])
      if (!included.has(row.resource_id)) peers.add(row.resource_id);
  }
  if (!peers.size) return [];
  const added = new Set<string>();
  // A bounded page is enough to make progress. The projection loop seeks any remaining
  // outside claimants after these complete atomic groups have entered its scope.
  for (const { operation } of await journal.pendingFor([...peers]))
    for (const edit of operation.edits) if (!included.has(edit.recordId)) added.add(edit.recordId);
  return [...added];
};
