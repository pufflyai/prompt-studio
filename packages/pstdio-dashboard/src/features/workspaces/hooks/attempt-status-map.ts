type AttemptStatusRow = { id: string; [key: string]: unknown };

export const buildAttemptStatusMap = (rows: AttemptStatusRow[] | undefined) => {
  const map = new Map<string, { name: string; color: string }>();
  if (!rows) return map;
  for (const row of rows) {
    map.set(row.id, { name: row.name as string, color: row.color as string });
  }
  return map;
};
