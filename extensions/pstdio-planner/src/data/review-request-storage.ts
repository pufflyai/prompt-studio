// Own the request and outcome collections and join them into one read model with derived state.

import { readCollectionRecords } from "@pstdio/sdk/data";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { prepareNavigationQueries } from "./navigation-queries";
import type {
  ReviewOutcome,
  ReviewRequest,
  ReviewRequestView,
  StoredReviewOutcome,
  TicketReviewRequests,
} from "./review-request-types";
import { parseStoredOutcome, parseStoredRequest } from "./review-request-validation";

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

export const readTicketReviewRequests = async (storage: ExtensionStorageApi) => {
  const [requests, outcomes] = await Promise.all([
    reviewRequestsCollection(storage).list(),
    reviewOutcomesCollection(storage).list(),
  ]);
  const outcomesById = new Map(outcomes.map((outcome) => [outcome.requestId, outcome]));
  const result = new Map<string, TicketReviewRequests>();
  for (const stored of requests) {
    const ticketId = String((stored as Partial<ReviewRequest>).ticketId);
    const group = result.get(ticketId) ?? { requests: [], errors: [] };
    result.set(ticketId, group);
    try {
      const request = parseStoredRequest(stored);
      const outcome = outcomesById.get(request.id);
      group.requests.push(toView(request, outcome ? parseStoredOutcome(request, outcome) : null));
    } catch (reason) {
      group.errors.push(`Request ${String((stored as Partial<ReviewRequest>).id)}: ${String(reason)}`);
    }
  }
  for (const group of result.values()) group.requests.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  return result;
};

export const listTicketReviewRequests = async (storage: ExtensionStorageApi, ticketId: string) => {
  await prepareNavigationQueries(storage);
  const result: TicketReviewRequests = { requests: [], errors: [] };
  let cursor: string | undefined;
  do {
    const page = await storage.records.query({
      index: "ticket-review-requests",
      where: { field: "ticketId", op: "eq", value: ticketId },
      fields: [],
      limit: 100,
      cursor,
    });
    const values = await readCollectionRecords<ReviewRequest>(
      storage,
      page.records.map(({ recordId }) => recordId),
    );
    for (const stored of values) {
      if (stored === undefined) continue;
      const id = String(stored.id);
      let request: ReviewRequest;
      try {
        request = parseStoredRequest(stored);
      } catch (reason) {
        result.errors.push(`Request ${id}: ${String(reason)}`);
        continue;
      }
      const outcome = await reviewOutcomesCollection(storage).get(request.id);
      try {
        result.requests.push(toView(request, outcome === undefined ? null : parseStoredOutcome(request, outcome)));
      } catch (reason) {
        result.errors.push(`Request ${id}: ${String(reason)}`);
      }
    }
    cursor = page.cursor ?? undefined;
  } while (cursor);
  result.requests.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  return result;
};

// Pending input comes from every open request; answers to other requests never hide it.
export const hasPendingInput = (group: TicketReviewRequests) =>
  group.errors.length > 0 || group.requests.some((request) => request.state === "open");

export const deleteTicketReviewRequests = async (storage: ExtensionStorageApi, ticketId: string) => {
  const requests = await reviewRequestsCollection(storage).list();
  for (const request of requests.filter((entry) => entry.ticketId === ticketId)) {
    await reviewRequestsCollection(storage).delete(request.id);
    await reviewOutcomesCollection(storage).delete(request.id);
  }
};
