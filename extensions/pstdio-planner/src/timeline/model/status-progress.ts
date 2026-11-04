import type { PlanRow } from "../contracts";

export function statusProgress(rows: Pick<PlanRow, "status">[]) {
  const groups = new Map<string | null, { id: string | null; name: string; color: string; count: number }>();
  for (const { status } of rows) {
    const id = status?.id ?? null;
    const group = groups.get(id) ?? {
      id,
      name: status?.name ?? "No status",
      color: status?.color ? `${status.color}.fg` : "fg.muted",
      count: 0,
    };
    group.count += 1;
    groups.set(id, group);
  }
  return [...groups.values()];
}
