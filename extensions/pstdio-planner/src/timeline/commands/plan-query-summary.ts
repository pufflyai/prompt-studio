import type { StorageExpression, StoragePredicate } from "@pstdio/sdk/extensions";
import { ticketTagAttributeId } from "../../data/mappers";
import type { readTicketViewPage } from "../../data/query-ticket-page";
import { activeTicket } from "../../data/ticket-view-state";
import type { PlanPace } from "../contracts";

type View = Awaited<ReturnType<typeof readTicketViewPage>>;
type Storage = Parameters<typeof readTicketViewPage>[0]["storage"];
const together = (...parts: (StoragePredicate | undefined)[]): StoragePredicate => ({
  all: parts.filter((part) => part !== undefined),
});

const predicateFields = (where: StoragePredicate): string[] => {
  if ("field" in where) return [where.field];
  if ("all" in where) return where.all.flatMap(predicateFields);
  if ("any" in where) return where.any.flatMap(predicateFields);
  if ("not" in where) return predicateFields(where.not);
  if ("exists" in where && where.exists.where) return predicateFields(where.exists.where);
  return [];
};

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

export const planQuerySummary = async (storage: Storage, view: View) => {
  const weight = complexityExpression(view);
  const done: StorageExpression = {
    op: "or",
    args: view.workflow.completedStatusIds.map((id) => ({ op: "eq", args: [{ field: "statusId" }, { literal: id }] })),
  };
  const computed = {
    ...view.scope.computed,
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
  const group = (where: StoragePredicate) =>
    storage.records.aggregate({
      index: "ticket-view",
      computed: {
        ...computed,
        ...Object.fromEntries(
          predicateFields(where)
            .filter((name) => name.startsWith("flag:"))
            .map((name) => [name, view.computed[name]]),
        ),
      },
      where,
      groupBy: "deadlineId",
      groupLimit: 500,
      metrics,
    });
  const filtered = together(view.scope.where, view.scope.search);
  const conditions = [
    undefined,
    view.predicates.done,
    view.predicates.needsReview,
    view.predicates.blocked,
    view.predicates.atRisk,
  ];
  const [global, globalDone, ...counts] = await Promise.all([
    group(activeTicket),
    group(together(activeTicket, view.predicates.done)),
    ...conditions.map((predicate) => group(together(filtered, predicate))),
  ]);
  const starts = await storage.records.aggregate({
    index: "attempt-ticket",
    where: {
      exists: { index: "ticket-view", on: [{ sourceField: "ticketId", relatedField: "id" }], where: activeTicket },
    },
    metrics: { first: { operation: "min", field: "startedAt" } },
  });
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
    completedGroups = byDeadline(globalDone.groups),
    selected = counts.map(({ groups }) => byDeadline(groups));
  const section = (id: string | null) => {
    const key = String(id),
      total = selected[0].get(key),
      entire = globalGroups.get(key);
    const quantities = total?.metrics;
    const remaining = (quantities?.totalComplexity ?? 0) - (quantities?.completedComplexity ?? 0);
    return {
      counts: {
        total: total?.count ?? 0,
        done: selected[1].get(key)?.count ?? 0,
        reviewNeeded: selected[2].get(key)?.count ?? 0,
        blocked: selected[3].get(key)?.count ?? 0,
        atRisk: id ? (selected[4].get(key)?.count ?? 0) : 0,
      },
      globalCounts: { total: entire?.count ?? 0, done: completedGroups.get(key)?.count ?? 0 },
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
