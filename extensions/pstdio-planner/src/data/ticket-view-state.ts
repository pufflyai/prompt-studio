import type {
  ExtensionStorageApi,
  JsonValue,
  StorageExpression,
  StoragePredicate,
  StorageRecordQuery,
} from "@pstdio/sdk/extensions";
import { readPlanMetadata } from "../timeline/commands/placement-store";
import { addDays } from "../timeline/model/days";
import { answeredReviewRequest, ticketHasPendingReview } from "./review-query-indexes";
import { independentBlocker } from "./ticket-independent-blocker";
import type { WorkflowStatusSelections } from "./workflow-statuses";

export const activeTicket: StoragePredicate = { field: "archived", op: "ne", value: true };
export const activeMilestoneValue = (values: Record<string, JsonValue>, fallback: JsonValue): StorageExpression => {
  if (!Object.keys(values).length) return { literal: fallback };
  return {
    op: "if",
    args: [
      {
        op: "or",
        args: [
          { op: "eq", args: [{ field: "archived" }, { literal: true }] },
          { op: "missing", args: [{ get: { literal: values }, key: { field: "deadlineId" } }] },
        ],
      },
      { literal: fallback },
      { get: { literal: values }, key: { field: "deadlineId" } },
    ],
  };
};

export const ticketViewState = async (
  storage: ExtensionStorageApi,
  workflow: WorkflowStatusSelections,
  deadlineId?: string | null,
) => {
  const metadata = await readPlanMetadata(storage);
  const done: StoragePredicate = { field: "statusId", op: "in", value: workflow.completedStatusIds };
  const unfinished: StoragePredicate = { all: [activeTicket, { not: done }] };
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  const progress =
    metadata.deadlines.length && deadlineId !== null
      ? await storage.records.aggregate({
          index: "ticket-view",
          where: deadlineId
            ? { all: [activeTicket, { field: "deadlineId", op: "eq", value: deadlineId }] }
            : activeTicket,
          groupBy: "deadlineId",
          groupLimit: 500,
          computed: { completedMilestoneTicket: { type: "number", cases: [{ when: done, value: 1 }], otherwise: 0 } },
          metrics: { done: { operation: "sum", field: "completedMilestoneTicket" } },
        })
      : undefined;
  const counts = new Map(progress?.groups.map(({ value, count }) => [String(value), count]));
  const doneCounts = new Map(progress?.groups.map(({ value, metrics }) => [String(value), metrics?.done ?? 0]));
  const dates = Object.fromEntries(metadata.deadlines.map((deadline) => [deadline.id, deadline.date]));
  const states = Object.fromEntries(
    metadata.deadlines.map((deadline) => {
      const total = counts.get(deadline.id) ?? 0;
      let state = "open";
      if (total > 0 && doneCounts.get(deadline.id) === total)
        state = deadline.date < today ? "completed-past" : "complete";
      return [deadline.id, state];
    }),
  );
  const relatedUnfinished = (reverse = false): StoragePredicate => ({
    exists: {
      index: "ticket-view",
      on: [
        {
          sourceField: reverse ? "id" : "dependsOn",
          relatedField: reverse ? "dependsOn" : "id",
          ...(reverse ? { op: "containedBy" as const } : { op: "contains" as const }),
        },
      ],
      where: unfinished,
    },
  });
  const hasAnswered: StoragePredicate = {
    exists: {
      index: "review-request-state",
      on: [{ sourceField: "id", relatedField: "ticketId" }],
      where: answeredReviewRequest,
    },
  };
  const waiting = relatedUnfinished();
  const blocked: StoragePredicate = {
    all: [
      unfinished,
      { not: waiting },
      { not: ticketHasPendingReview },
      { any: [{ field: "statusId", op: "in", value: workflow.blockedStatusIds }, independentBlocker] },
    ],
  };
  const atRisk: StoragePredicate = {
    all: [
      unfinished,
      {
        any: [
          ticketHasPendingReview,
          waiting,
          { field: "statusId", op: "in", value: workflow.blockedStatusIds },
          independentBlocker,
        ],
      },
    ],
  };
  const ranks = Object.fromEntries(metadata.deadlines.map(({ id }, rank) => [id, rank]));
  const rank = (up = 0): StorageExpression => {
    if (!metadata.deadlines.length) return { literal: 0 };
    const found: StorageExpression = { get: { literal: ranks }, key: { field: "deadlineId", up } };
    return { op: "if", args: [{ op: "missing", args: [found] }, { literal: metadata.deadlines.length }, found] };
  };
  const laterPosition: StorageExpression = {
    op: "or",
    args: [
      { op: "gt", args: [{ field: "planPosition" }, { field: "planPosition", up: 1 }] },
      {
        op: "and",
        args: [
          { op: "missing", args: [{ field: "planPosition" }] },
          { op: "not", args: [{ op: "missing", args: [{ field: "planPosition", up: 1 }] }] },
        ],
      },
    ],
  };
  const computed: NonNullable<StorageRecordQuery["computed"]> = {
    archiveState: {
      type: "string",
      cases: [{ when: { field: "archived", op: "eq", value: true }, value: "archived" }],
      otherwise: "active",
    },
    milestone: {
      type: "string",
      expression: {
        op: "if",
        args: [
          {
            op: "and",
            args: [
              { op: "not", args: [{ field: "archived" }] },
              { op: "isString", args: [{ field: "deadlineId" }] },
            ],
          },
          { field: "deadlineId" },
          { literal: "" },
        ],
      },
    },
    milestoneState: { type: "string", expression: activeMilestoneValue(states, "unscheduled") },
    needsAttention: {
      type: "string",
      cases: [
        {
          when: {
            all: [
              unfinished,
              {
                any: [
                  ticketHasPendingReview,
                  relatedUnfinished(),
                  relatedUnfinished(true),
                  { field: "statusId", op: "in", value: workflow.blockedStatusIds },
                  independentBlocker,
                  {
                    field: "deadlineId",
                    op: "in",
                    value: metadata.deadlines.filter(({ date }) => date <= addDays(today, 7)).map(({ id }) => id),
                  },
                ],
              },
            ],
          },
          value: "yes",
        },
      ],
      otherwise: "no",
    },
    reviewRequests: {
      type: "string",
      cases: [
        { when: { all: [activeTicket, ticketHasPendingReview] }, value: "requested" },
        { when: { all: [activeTicket, hasAnswered] }, value: "answered" },
      ],
      otherwise: "",
    },
    deadlineRank: { type: "number", expression: rank() },
  };
  computed.milestoneDate = { type: "string", expression: activeMilestoneValue(dates, null) };
  computed.independentBlockedReason = {
    type: "boolean",
    cases: [{ when: independentBlocker, value: true }],
    otherwise: false,
  };
  computed.hasUnmetDependency = { type: "boolean", cases: [{ when: waiting, value: true }], otherwise: false };
  computed.hasUnfinishedDependent = {
    type: "boolean",
    cases: [{ when: relatedUnfinished(true), value: true }],
    otherwise: false,
  };
  computed.hasLaterDependency = {
    type: "boolean",
    cases: [
      {
        when: {
          exists: {
            index: "ticket-view",
            on: [{ sourceField: "dependsOn", relatedField: "id", op: "contains" }],
            where: {
              all: [
                unfinished,
                {
                  test: metadata.deadlines.length
                    ? {
                        op: "or",
                        args: [
                          { op: "gt", args: [rank(), rank(1)] },
                          { op: "and", args: [{ op: "eq", args: [rank(), rank(1)] }, laterPosition] },
                        ],
                      }
                    : laterPosition,
                },
              ],
            },
          },
        },
        value: true,
      },
    ],
    otherwise: false,
  };
  const conditions = {
    done,
    blocked,
    atRisk,
    needsReview: { all: [unfinished, ticketHasPendingReview] } satisfies StoragePredicate,
  };
  const predicates = Object.fromEntries(
    Object.entries(conditions).map(([name, when]) => {
      computed[`flag:${name}`] = { type: "boolean", cases: [{ when, value: true }], otherwise: false };
      return [name, { field: `flag:${name}`, op: "eq", value: true } satisfies StoragePredicate];
    }),
  ) as Record<keyof typeof conditions, StoragePredicate>;
  return { computed, metadata, today, conditions, predicates: { ...predicates, unfinished, waiting } };
};
