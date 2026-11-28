import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";

export type CollectionQueryPolicy = { mode: "paged" | "static"; maxRows?: number };
const boundedRead = (): never => {
  throw new Error(
    "Collection renderers require bounded queries; use records.query/aggregate instead of loading a complete resource collection.",
  );
};

/** The guard belongs to one invocation and follows scopes and nested commands. */
export const boundedQueryStorage = (storage: ExtensionStorageApi): ExtensionStorageApi => ({
  ...storage,
  records: { ...storage.records, list: boundedRead },
  collection: <T>(name: string) => ({ ...storage.collection<T>(name), list: boundedRead }),
  scope: (scope) => boundedQueryStorage(storage.scope(scope)),
});
export const rejectUnboundedCollectionRead = boundedRead;

const validateLimit = (limit: unknown, minimum = 1): number => {
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < minimum || limit > 500)
    throw new Error(`Collection queries need a bounded row limit between ${minimum} and 500`);
  return limit;
};

export const boundedQueryAutomation = (
  automation: ExtensionContextBase["automation"],
): ExtensionContextBase["automation"] => ({
  ...automation,
  list: (options) => {
    validateLimit(options?.limit);
    return automation.list(options);
  },
});

export const validateCollectionQueryRequest = (
  policy: CollectionQueryPolicy | undefined,
  params: Record<string, unknown>,
) => {
  if (!policy) return;
  const request = params.page as { limit?: number; offset?: number } | undefined;
  // Paged providers can return summaries with a zero-row request.
  const limit = policy.mode === "static" ? validateLimit(policy.maxRows) : validateLimit(request?.limit ?? 100, 0);
  if (request?.offset !== undefined && (!Number.isSafeInteger(request.offset) || request.offset < 0))
    throw new Error("Collection query offsets must be nonnegative safe integers");
  return limit;
};

export const validateCollectionQueryResult = (
  policy: CollectionQueryPolicy | undefined,
  params: Record<string, unknown>,
  result: unknown,
) => {
  if (!policy) return;
  type Row = { children?: Row[] };
  const value = result as {
    rows?: Row[];
    page?: { revision?: unknown; cursor?: unknown; total?: number; filteredTotal?: number; groups?: unknown[] };
  };
  const limit = validateCollectionQueryRequest(policy, params)!;
  if (!value || !Array.isArray(value.rows)) throw new Error("Collection query must return rows");
  const exceeded = () => {
    throw new Error(`Collection query returned more than ${limit} rows; its bounded limit is ${limit}`);
  };
  if (value.rows.length > limit) exceeded();
  const pending = [...value.rows];
  let count = 0;
  while (pending.length) {
    const row = pending.pop()!;
    count++;
    if (row.children) {
      if (!Array.isArray(row.children)) throw new Error("Collection row children must be an array");
      if (count + pending.length + row.children.length > limit) exceeded();
      pending.push(...row.children);
    }
  }
  if (policy.mode === "static") return;
  const page = value.page;
  if (
    !page ||
    typeof page.revision !== "string" ||
    !page.revision ||
    !(page.cursor === null || typeof page.cursor === "string") ||
    !Number.isSafeInteger(page.total) ||
    page.total! < 0 ||
    !Number.isSafeInteger(page.filteredTotal) ||
    page.filteredTotal! < value.rows.length ||
    page.filteredTotal! > page.total! ||
    !Array.isArray(page.groups) ||
    // At most 500 grouped combinations can contribute both a parent and a child summary.
    page.groups.length > 1000
  )
    throw new Error("Paged collection queries must return bounded rows and consistent global page counts");
};
