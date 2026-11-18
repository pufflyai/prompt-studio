// Own the request and outcome collections and join them into one read model with derived state.

import { readCollectionRecords } from "@pstdio/sdk/data";
import type { ExtensionStorageApi, StoragePredicate } from "@pstdio/sdk/extensions";
import { prepareNavigationQueries } from "./navigation-queries";
import type {
  ReviewOutcome,
  ReviewRequest,
  ReviewRequestView,
  StoredReviewOutcome,
  TicketReviewRequests,
} from "./review-request-types";
import { parseStoredOutcome, parseStoredRequest } from "./review-request-validation";
import { inBatches } from "./ticket-selection";

// New collection names: records from the old free-text request format are not read or migrated.
export const REVIEW_REQUESTS_COLLECTION = "planner-review-requests";
export const REVIEW_OUTCOMES_COLLECTION = "planner-review-request-outcomes";

export const reviewRequestsCollection = (storage: ExtensionStorageApi) =>
  storage.collection<ReviewRequest>(REVIEW_REQUESTS_COLLECTION);

export const reviewOutcomesCollection = (storage: ExtensionStorageApi) =>
  storage.collection<StoredReviewOutcome>(REVIEW_OUTCOMES_COLLECTION);

const answerText = (request: ReviewRequest, questionId: string, value: string | string[]) => {
  const question =
    request.request.kind === "decision" ? request.request.questions.find(({ id }) => id === questionId) : undefined;
  const options = question && question.input.kind !== "text" ? question.input.options : [];
  const answer = (Array.isArray(value) ? value : [value])
    .map((id) => options.find((option) => option.id === id)?.label ?? id)
    .join(", ");
  return `${question?.label ?? questionId}: ${answer}`;
};

const describeOutcome = (request: ReviewRequest, outcome: ReviewOutcome | null) => {
  if (!outcome) return null;
  if (outcome.kind === "cancelled") return `Cancelled: ${outcome.reason}`;
  if (request.request.kind === "task" || "confirmed" in outcome.response) return "Completion confirmed";
  const { answers } = outcome.response;
  return request.request.questions
    .flatMap(({ id }) => (answers[id] === undefined ? [] : [answerText(request, id, answers[id])]))
    .join("\n");
};

const toView = (request: ReviewRequest, outcome: ReviewOutcome | null): ReviewRequestView => ({
  ...request,
  state: outcome?.kind ?? "open",
  outcome,
  outcomeText: describeOutcome(request, outcome),
});

export const readReviewRequest = async (storage: ExtensionStorageApi, requestId: string) => {
  const stored = await reviewRequestsCollection(storage).get(requestId);
  if (stored === undefined) return null;
  const request = parseStoredRequest(stored);
  const outcome = await reviewOutcomesCollection(storage).get(requestId);
  return toView(request, outcome === undefined ? null : parseStoredOutcome(request, outcome));
};

/** Read one request window. Overview rows use aggregate counts instead of these bodies. */
export const readReviewRequestPage = async (
  storage: ExtensionStorageApi,
  where: StoragePredicate,
  offset = 0,
  limit = 25,
) => {
  await prepareNavigationQueries(storage);
  const total = await storage.records.aggregate({ index: "review-request-state", where });
  const page = await storage.records.query({
    index: "review-request-state",
    where,
    fields: [],
    offset,
    limit,
    orderBy: [
      { field: "requestedAt", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
    revision: total.revision,
  });
  const result: TicketReviewRequests = { requests: [], errors: [] };
  const values = await readCollectionRecords<ReviewRequest>(
    storage,
    page.records.map(({ recordId }) => recordId),
  );
  for (const stored of values) {
    if (!stored) continue;
    try {
      const request = parseStoredRequest(stored);
      const outcome = await reviewOutcomesCollection(storage).get(request.id);
      result.requests.push(toView(request, outcome === undefined ? null : parseStoredOutcome(request, outcome)));
    } catch (reason) {
      result.errors.push(`Request ${String(stored.id)}: ${String(reason)}`);
    }
  }
  await storage.records.query({ index: "review-request-state", where, fields: [], limit: 1, revision: total.revision });
  return { ...result, total: total.count, hasNext: Boolean(page.cursor), offset };
};

// Pending input comes from every open request; answers to other requests never hide it.
export const hasPendingInput = (group: TicketReviewRequests) =>
  group.errors.length > 0 || group.requests.some((request) => request.state === "open");

export const deleteTicketReviewRequests = async (storage: ExtensionStorageApi, ticketId: string) => {
  await prepareNavigationQueries(storage);
  for (;;) {
    // Each deletion changes the revision, so select the next remaining page without a stale cursor.
    const page = await storage.records.query({
      index: "ticket-review-requests",
      where: { field: "ticketId", op: "eq", value: ticketId },
      fields: [],
      limit: 100,
    });
    if (!page.records.length) return;
    const requests = await readCollectionRecords<Partial<ReviewRequest>>(
      storage,
      page.records.map(({ recordId }) => recordId),
    );
    await inBatches(requests, async (request) => {
      if (typeof request?.id === "string") await reviewOutcomesCollection(storage).delete(request.id);
    });
    await storage.records.commit({
      operationId: storage.ids.create(),
      edits: page.records.map(({ recordId }) => ({ recordId, deleted: true })),
    });
  }
};
