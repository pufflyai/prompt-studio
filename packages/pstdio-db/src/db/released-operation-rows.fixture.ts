/** Reconstruct the released logical graph from the consolidated operations row for upgrade proofs. */
export const releasedOperationQuery = (table: string) => {
  if (table === "storage_ordered_operations")
    return `SELECT
    to_jsonb(s)-'owner_id'-'touches'-'receipt_epoch'-'receipt'-'receipt_indexed' ||
    jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id) AS row
    FROM operations s JOIN owners o ON s.owner_id=o.id`;
  if (table === "storage_ordered_touches")
    return `SELECT jsonb_build_object(
    'workbench_id',o.project_id,'extension_id',o.extension_id,'record_id',record_id,
    'operation_id',s.operation_id,'local_sequence',s.local_sequence) AS row
    FROM operations s JOIN owners o ON s.owner_id=o.id CROSS JOIN LATERAL unnest(s.touches) record_id`;
  if (table === "storage_ordered_receipts")
    return `SELECT jsonb_build_object(
    'workbench_id',o.project_id,'extension_id',o.extension_id,'epoch',fact.key,
    'operation_id',s.operation_id,'admission_fingerprint',fact.value->>'admissionFingerprint',
    'state',fact.value->>'state','indexed',(fact.value->>'indexed')::boolean) AS row
    FROM operations s JOIN owners o ON s.owner_id=o.id CROSS JOIN LATERAL jsonb_each(s.receipt) fact(key,value)`;
  return `SELECT (to_jsonb(s)-'owner_id') ||
    jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id) AS row
    FROM ${table} s JOIN owners o ON s.owner_id=o.id`;
};
