/**
 * A resource list's sub-groupings after the rules every layer shares: none without a grouping,
 * and each field used once, never repeating the grouping field. Order is kept.
 */
export const normalizeSubGroupings = (columnGrouping: string, subGroupings: readonly string[] | undefined) => {
  if (columnGrouping === "none") return [];
  const used = new Set([columnGrouping, "none"]);
  return (subGroupings ?? []).filter((id) => !used.has(id) && Boolean(used.add(id)));
};
