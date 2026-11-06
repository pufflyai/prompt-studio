export const bySortOrder = <T extends { sortOrder: number; id?: string; name?: string }>(left: T, right: T) =>
  left.sortOrder - right.sortOrder ||
  (left.name ?? "").localeCompare(right.name ?? "") ||
  (left.id ?? "").localeCompare(right.id ?? "");

export const sortedBySortOrder = <T extends { sortOrder: number; id?: string; name?: string }>(items: T[]) =>
  [...items].sort(bySortOrder);

const compareText = (a: string, b: string) => (a < b ? -1 : Number(a > b));

export const sortedByTicketOrder = <T extends { position?: string; sortOrder?: number; id: string }>(items: T[]) =>
  [...items].sort((a, b) => {
    if (a.position && b.position) return compareText(a.position, b.position) || compareText(a.id, b.id);
    if (a.position) return -1;
    if (b.position) return 1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || compareText(a.id, b.id);
  });
