export const bySortOrder = <T extends { sortOrder: number; id?: string; name?: string }>(left: T, right: T) =>
  left.sortOrder - right.sortOrder ||
  (left.name ?? "").localeCompare(right.name ?? "") ||
  (left.id ?? "").localeCompare(right.id ?? "");

export const sortedBySortOrder = <T extends { sortOrder: number; id?: string; name?: string }>(items: T[]) =>
  [...items].sort(bySortOrder);
