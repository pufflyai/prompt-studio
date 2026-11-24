import { DEFAULT_COLLECTION_PAGE_SIZE, type KanbanRendererQueryParams, storageLimits } from "@pstdio/sdk/extensions";

const hasRules = (filter?: KanbanRendererQueryParams["filter"]): boolean => {
  if (!filter) return false;
  // The default saved-view rule does not narrow Timeline's active execution order.
  if (filter.conjunction !== "and") return Boolean(filter.rules.length || filter.groups?.some(hasRules));
  return Boolean(
    filter.rules.some(
      (rule) =>
        rule.attributeId !== "archived" ||
        rule.condition !== "is-any-of" ||
        !Array.isArray(rule.value) ||
        !rule.value.includes("active"),
    ) || filter.groups?.some(hasRules),
  );
};

/** Only an unfiltered numeric window can stop after its canonical execution prefix.
 * Filtered and selected rows still initialize the full order for exact global steps.
 */
export const planReadWindow = (
  input: Pick<Partial<KanbanRendererQueryParams>, "filter" | "page"> & { ticketId?: string },
  hidden: boolean,
) => {
  const limit = input.page?.limit ?? DEFAULT_COLLECTION_PAGE_SIZE;
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > storageLimits.queryLimit)
    throw new Error(`Query limit must be between 0 and ${storageLimits.queryLimit}`);
  const offset = input.page?.offset ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Query offset must be a nonnegative safe integer");
  const executionOffset =
    !input.ticketId && !hasRules(input.filter) && !input.page?.search.trim() && !hidden && !input.page?.cursor ? offset : undefined;
  const bounded =
    executionOffset !== undefined &&
    !input.page?.collapsedGroups?.length &&
    (!input.page?.cursor || input.page.offset !== undefined);
  return { executionOffset, initializationCount: bounded ? offset + limit : undefined };
};
