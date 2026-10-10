// Expose Planner's review requests to people, agents, the timeline, and attempt workflows.
import { defineCommand, params } from "@pstdio/sdk/extensions";
import type { AttemptState } from "../data/attempt-types";
import { findTicket } from "../data/resolve";
import { type CreateReviewRequestInput, createReviewRequest } from "../data/review-request-create";
import { answerReviewRequest, cancelReviewRequest, openReviewRequestSession } from "../data/review-request-service";
import { listTicketReviewRequests, readReviewRequest } from "../data/review-request-storage";
import type { HumanRequestReason, ReviewRequestBody, ReviewResponse } from "../data/review-request-types";

const humanRequestReasons: HumanRequestReason[] = [
  "approved-revision",
  "ambiguous-dependency-attempt",
  "divergent-dependency-attempts",
  "dependency-cycle",
  "dependency-missing",
  "implementation-disconnected",
  "review-disconnected",
  "workspace-adoption-required",
];

const attemptStates: AttemptState[] = [
  "implementing",
  "review_ready",
  "reviewing",
  "approved",
  "changes_requested",
  "blocked",
  "abandoned",
];

export const requestHumanCommand = defineCommand({
  id: "request-human",
  title: "Request human input",
  cli: { description: "Ask a person for a task confirmation or a decision and set Review Needed." },
  mutating: true,
  params: {
    ticket: params.text({ required: true }),
    title: params.text({ required: true }),
    instructions: params.longText({ required: true }),
    request: params.json<ReviewRequestBody, { required: true }>({ required: true }),
    reason: params.select({ options: humanRequestReasons.map((reason) => ({ label: reason, value: reason })) }),
    workspaceId: params.text(),
    revision: params.number(),
    sessionId: params.text(),
    expectedTicketStatusId: params.text(),
    expectedAttemptState: params.select({
      options: attemptStates.map((state) => ({ label: state, value: state })),
    }),
  },
  async run(ctx, commandParams) {
    return createReviewRequest(ctx, commandParams as CreateReviewRequestInput);
  },
});

export const reviewCommand = defineCommand({
  id: "review",
  title: "Answer a review request",
  cli: { description: "Save a person's answer to a human review request. Code reviews use run-review." },
  mutating: true,
  params: {
    requestId: params.text({ required: true }),
    response: params.json<ReviewResponse, { required: true }>({ required: true }),
  },
  async run(ctx, { requestId, response }) {
    return answerReviewRequest(ctx, requestId, response);
  },
});

export const readReviewRequestCommand = defineCommand({
  id: "review-requests.read",
  title: "Read a review request",
  cli: { description: "Read a request with its questions, choices, and saved outcome." },
  params: { requestId: params.text({ required: true }) },
  async run(ctx, { requestId }) {
    const request = await readReviewRequest(ctx.storage, requestId);
    if (!request) throw new Error(`Unknown review request "${requestId}".`);
    return request;
  },
});

export const listReviewRequestsCommand = defineCommand({
  id: "review-requests.list",
  title: "List review requests",
  cli: { description: "List a ticket's review requests and their history." },
  params: { ticket: params.text({ required: true }), openOnly: params.boolean() },
  async run(ctx, { ticket, openOnly }) {
    const found = await findTicket(ctx.storage, ticket);
    if (!found) throw new Error(`Unknown ticket "${ticket}"`);
    const { requests, errors } = await listTicketReviewRequests(ctx.storage, found.id);
    return { requests: openOnly ? requests.filter((request) => request.state === "open") : requests, errors };
  },
});

export const cancelReviewRequestCommand = defineCommand({
  id: "review-requests.cancel",
  title: "Cancel a review request",
  cli: { description: "Withdraw an open request. Correct it by creating a new request." },
  mutating: true,
  params: { requestId: params.text({ required: true }), reason: params.text({ required: true }) },
  async run(ctx, { requestId, reason }) {
    return cancelReviewRequest(ctx, requestId, reason);
  },
});

export const openReviewRequestCommand = defineCommand({
  id: "review-requests.open",
  title: "Open a review request chat",
  cli: { description: "Open the chat linked to a request. Opening it records no answer." },
  params: { requestId: params.text({ required: true }) },
  async run(ctx, { requestId }) {
    return openReviewRequestSession(ctx, requestId);
  },
});
