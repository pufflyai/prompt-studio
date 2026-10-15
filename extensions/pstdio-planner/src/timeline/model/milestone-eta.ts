import type { AttemptRecord } from "../../data/attempt-types";
import { ticketTagAttributeId } from "../../data/mappers";
import type { PlanRow, PlanTag } from "../contracts";

type ComplexityTag = Pick<PlanTag, "id" | "name"> & { options: Pick<PlanTag["options"][number], "id" | "sortOrder">[] };

export function milestoneEta(
  rows: Pick<PlanRow, "id" | "done" | "tagIds">[],
  tags: ComplexityTag[],
  attempts: Pick<AttemptRecord, "ticketId" | "createdAt">[],
  now: number,
) {
  if (!rows.length) return null;
  const complexity =
    tags.find((tag) => ticketTagAttributeId(tag) === "complexity") ??
    tags.find(({ name }) => name.trim().toLowerCase() === "complexity");
  const weights = new Map(
    [...(complexity?.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map(({ id }, i) => [id, i + 1]),
  );
  const defaultWeight = Math.ceil((weights.size || 1) / 2);
  const weight = (row: (typeof rows)[number]) =>
    row.tagIds.map((id) => weights.get(id)).find((value) => value !== undefined) ?? defaultWeight;
  const totalComplexity = rows.reduce((total, row) => total + weight(row), 0);
  const completedComplexity = rows.filter(({ done }) => done).reduce((total, row) => total + weight(row), 0);
  const ids = new Set(rows.map(({ id }) => id));
  const starts = attempts.filter(({ ticketId }) => ids.has(ticketId)).map(({ createdAt }) => Date.parse(createdAt));
  const start = Math.min(...starts);
  const startedAt = Number.isFinite(start) ? new Date(start).toISOString() : null;
  if (completedComplexity === totalComplexity)
    return { remainingMs: 0, completedComplexity, totalComplexity, startedAt };
  if (!completedComplexity || !startedAt || now <= start) return null;
  // Wall-clock throughput already includes parallel work and time spent waiting.
  const remainingMs = ((now - start) * (totalComplexity - completedComplexity)) / completedComplexity;
  return { remainingMs, completedComplexity, totalComplexity, startedAt };
}
