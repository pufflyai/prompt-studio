import type { StoragePredicate, StorageRecordIndex } from "@pstdio/sdk/extensions";
import {
  validOutcomeHeaderExpression,
  validResponseExpression,
  validStoredRequestExpression,
} from "./review-query-expressions";

export const reviewQueryIndexes: StorageRecordIndex[] = [
  {
    name: "review-request-state",
    collection: "planner-review-requests",
    fields: {
      id: { path: ["id"], type: "string" },
      requestedAt: { path: ["requestedAt"], type: "string" },
      ticketId: { path: ["ticketId"], type: "string", derive: { kind: "string" } },
      attemptRevision: { path: ["context", "attemptRevision"], type: "number" },
      workspaceId: { path: ["context", "workspaceId"], type: "string" },
      attemptId: { path: ["context", "attemptId"], type: "string" },
      affectedAction: { path: ["context", "affectedAction"], type: "string" },
      reason: { path: ["context", "reason"], type: "string" },
      sessionId: { path: ["context", "sessionId"], type: "string" },
      relatedSessionId: { path: ["context", "relatedSessionId"], type: "string" },
      body: { path: ["request"], type: "object" },
      valid: { path: [], type: "boolean", derive: { kind: "expression", expression: validStoredRequestExpression } },
    },
    equality: ["ticketId", "id"],
  },
  {
    name: "review-outcome-state",
    collection: "planner-review-request-outcomes",
    fields: {
      requestKey: { path: ["requestId"], type: "string", derive: { kind: "collectionKey" } },
      kind: { path: ["kind"], type: "string" },
      response: { path: ["response"], type: "object" },
      valid: { path: [], type: "boolean", derive: { kind: "expression", expression: validOutcomeHeaderExpression } },
    },
    equality: ["requestKey"],
  },
];

export const validReviewOutcome = {
  exists: {
    index: "review-outcome-state",
    on: [{ sourceField: "id", relatedField: "requestKey" }],
    where: {
      all: [
        { field: "valid", op: "eq", value: true },
        { any: [{ field: "kind", op: "eq", value: "cancelled" }, { test: validResponseExpression }] },
      ],
    },
  },
} satisfies StoragePredicate;

export const pendingReviewRequest: StoragePredicate = {
  any: [{ field: "valid", op: "ne", value: true }, { not: validReviewOutcome }],
};

export const answeredReviewRequest: StoragePredicate = {
  all: [
    { field: "valid", op: "eq", value: true },
    {
      exists: {
        index: "review-outcome-state",
        on: [{ sourceField: "id", relatedField: "requestKey" }],
        where: {
          all: [
            { field: "valid", op: "eq", value: true },
            { field: "kind", op: "eq", value: "answered" },
            { test: validResponseExpression },
          ],
        },
      },
    },
  ],
};

export const ticketHasPendingReview: StoragePredicate = {
  exists: {
    index: "review-request-state",
    on: [{ sourceField: "id", relatedField: "ticketId" }],
    where: pendingReviewRequest,
  },
};
