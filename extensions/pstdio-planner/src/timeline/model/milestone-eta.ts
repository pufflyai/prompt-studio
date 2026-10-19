import type { AttemptRecord } from "../../data/attempt-types";
import { ticketTagAttributeId } from "../../data/mappers";
import type { PlanPace, PlanRow, PlanTag } from "../contracts";

type ComplexityTag = Pick<PlanTag, "id" | "name"> & { options: Pick<PlanTag["options"][number], "id" | "sortOrder">[] };

type EstimateRow = Pick<PlanRow, "id" | "done" | "tagIds">;

function complexityTotals(rows: EstimateRow[], tags: ComplexityTag[]) {
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
  return { completedComplexity, totalComplexity };
}

export function projectPace(
  rows: EstimateRow[],
  tags: ComplexityTag[],
  attempts: Pick<AttemptRecord, "ticketId" | "createdAt">[],
  now: number,
) {
  const { completedComplexity } = complexityTotals(rows, tags);
  const ids = new Set(rows.map(({ id }) => id));
  const starts = attempts.filter(({ ticketId }) => ids.has(ticketId)).map(({ createdAt }) => Date.parse(createdAt));
  const start = Math.min(...starts);
  if (!completedComplexity || !Number.isFinite(start) || now <= start) return null;
  // Wall-clock throughput already includes parallel work and time spent waiting.
  return { msPerComplexity: (now - start) / completedComplexity, startedAt: new Date(start).toISOString() };
}

export function milestoneEta(rows: EstimateRow[], tags: ComplexityTag[], pace: PlanPace | null) {
  if (!rows.length) return null;
  const { completedComplexity, totalComplexity } = complexityTotals(rows, tags);
  const remaining = totalComplexity - completedComplexity;
  if (remaining && !pace) return null;
  return {
    remainingMs: remaining * (pace?.msPerComplexity ?? 0),
    completedComplexity,
    totalComplexity,
    startedAt: pace?.startedAt ?? null,
  };
}
