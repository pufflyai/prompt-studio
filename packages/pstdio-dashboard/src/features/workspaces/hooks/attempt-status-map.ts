type AttemptStatusRow = { id: string; name?: string; label?: string; color?: string; description?: string | null };

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
      name: row.name ?? row.label ?? row.id,
      color: row.color ?? "gray",
      description: row.description ?? null,
    });
  }
  return map;
};
