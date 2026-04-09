type AttemptStatusRow = { id: string; [key: string]: unknown };

export interface AttemptStatusMapEntry {
  name: string;
  color: string;
  description?: string | null;
}

export const buildAttemptStatusMap = (rows: AttemptStatusRow[] | undefined) => {
  const map = new Map<string, AttemptStatusMapEntry>();
  if (!rows) return map;
  for (const row of rows) {
    map.set(row.id, {
      name: row.name as string,
      color: row.color as string,
      description: (row.description as string | null | undefined) ?? null,
    });
  }
  return map;
};
