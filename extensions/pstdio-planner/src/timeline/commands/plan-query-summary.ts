import type { StorageComputedField, StorageExpression, StoragePredicate } from "@pstdio/sdk/extensions";
import { ticketTagAttributeId } from "../../data/mappers";
import type { readTicketViewPage } from "../../data/query-ticket-page";
import { selectedTicketComputedFields } from "../../data/ticket-computed-selection";
import { activeTicket } from "../../data/ticket-view-state";
import type { PlanPace } from "../contracts";

type View = Awaited<ReturnType<typeof readTicketViewPage>>;
type Storage = Parameters<typeof readTicketViewPage>[0]["storage"];
const together = (...parts: (StoragePredicate | undefined)[]): StoragePredicate => ({
  all: parts.filter((part) => part !== undefined),
});

const complexityExpression = (view: View): StorageExpression => {
  const tag =
    view.tags.find((tag) => ticketTagAttributeId(tag) === "complexity") ??
    view.tags.find(({ name }) => name.trim().toLowerCase() === "complexity");
  const weights = Object.fromEntries(
    [...(tag?.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map(({ id }, i) => [id, i + 1]),
  );
  const selected: StorageExpression = {
    op: "first",
    args: [
      {
        each: { get: { field: "tags" }, key: tag?.id ?? "" },
        as: "option",
        mode: "filter",
        where: {
          op: "not",
          args: [{ op: "missing", args: [{ get: { literal: weights }, key: { variable: "option" } }] }],
        },
      },
    ],
  };
  const weight: StorageExpression = { get: { literal: weights }, key: selected };
  return {
    op: "if",
    args: [{ op: "missing", args: [weight] }, { literal: Math.ceil((Object.keys(weights).length || 1) / 2) }, weight],
  };
};

export const planQuerySummary = async (storage: Storage, view: View, selectsAllActive = false) => {
  const weight = complexityExpression(view);
  const done: StorageExpression = {
    op: "or",
    args: view.workflow.completedStatusIds.map((id) => ({ op: "eq", args: [{ field: "statusId" }, { literal: id }] })),
  };
  const computed = {
    complexityWeight: { type: "number" as const, expression: weight },
    completedWeight: {
      type: "number" as const,
      expression: { op: "if" as const, args: [done, weight, { literal: 0 }] },
    },
  };
  const metrics = {
    totalComplexity: { operation: "sum" as const, field: "complexityWeight" },
    completedComplexity: { operation: "sum" as const, field: "completedWeight" },
  };
  const filtered = together(view.scope.where, view.scope.search);
  const conditions = {
    done: view.conditions.done,
    reviewNeeded: view.conditions.needsReview,
    blocked: view.conditions.blocked,
    atRisk: view.conditions.atRisk,
  };
  const countFields = Object.fromEntries(
    Object.entries(conditions).map(([name, when]) => [
      `count:${name}`,
      { type: "number", cases: [{ when, value: 1 }], otherwise: 0 } satisfies StorageComputedField,
    ]),
  );
  const flags = selectedTicketComputedFields(view.computed, [filtered]);
  const countMetrics = Object.fromEntries(
    Object.keys(conditions).map((name) => [name, { operation: "sum" as const, field: `count:${name}` }]),
  );
  const group = (where: StoragePredicate, selected: boolean) =>
    storage.records.aggregate({
      index: "ticket-view",
      computed: { ...computed, ...flags, ...countFields },
      where,
      formats: view.scope.formats,
      groupBy: "deadlineId",
      groupLimit: 500,
      metrics: { ...metrics, ...(selected ? countMetrics : { done: countMetrics.done }) },
    });
  // An unfiltered Timeline shares one scan for selected and global totals.
  const summaries = selectsAllActive
    ? group(filtered, true).then((summary) => [summary, summary])
    : Promise.all([group(activeTicket, false), group(filtered, true)]);
  const firstAttempt = storage.records.aggregate({
    index: "attempt-ticket",
    where: {
      exists: { index: "ticket-view", on: [{ sourceField: "ticketId", relatedField: "id" }], where: activeTicket },
    },
    metrics: { first: { operation: "min", field: "startedAt" } },
  });
  const [[global, selected], starts] = await Promise.all([summaries, firstAttempt]);
  const completedComplexity = global.groups.reduce(
    (total, group) => total + (group.metrics?.completedComplexity ?? 0),
    0,
  );
  const started = starts.metrics?.first;
  const now = Date.now();
  const pace: PlanPace | null =
    completedComplexity && started != null && now > started
      ? { msPerComplexity: (now - started) / completedComplexity, startedAt: new Date(started).toISOString() }
      : null;
  const byDeadline = (groups: typeof global.groups) => new Map(groups.map((group) => [String(group.value), group]));
  const globalGroups = byDeadline(global.groups),
    selectedGroups = byDeadline(selected.groups);
  const section = (id: string | null) => {
    const key = String(id),
      total = selectedGroups.get(key),
      entire = globalGroups.get(key);
    const quantities = total?.metrics;
    const remaining = (quantities?.totalComplexity ?? 0) - (quantities?.completedComplexity ?? 0);
    return {
      counts: {
        total: total?.count ?? 0,
        done: quantities?.done ?? 0,
        reviewNeeded: quantities?.reviewNeeded ?? 0,
        blocked: quantities?.blocked ?? 0,
        atRisk: id ? (quantities?.atRisk ?? 0) : 0,
      },
      globalCounts: { total: entire?.count ?? 0, done: entire?.metrics?.done ?? 0 },
      eta:
        id && total?.count && (!remaining || pace)
          ? {
              remainingMs: remaining * (pace?.msPerComplexity ?? 0),
              completedComplexity: quantities?.completedComplexity ?? 0,
              totalComplexity: quantities?.totalComplexity ?? 0,
              startedAt: pace?.startedAt ?? null,
            }
          : null,
    };
  };
  return { pace, section, globalGroups };
};
