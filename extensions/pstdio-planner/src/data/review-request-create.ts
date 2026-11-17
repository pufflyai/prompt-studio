// Save review requests without starting or continuing an agent session.
import type { CommandContext } from "@pstdio/sdk/extensions";
import { actorFromSource } from "./attempt-actors";
import { readAttempt } from "./attempt-storage";
import type { AttemptState } from "./attempt-types";
import { findTicket } from "./resolve";
import { keepOwnedRequest, publishRequestChange } from "./review-request-service";
import { readReviewRequest, reviewRequestsCollection } from "./review-request-storage";
import type { ReviewRequest, ReviewRequestReason } from "./review-request-types";
import { parseRequestBody } from "./review-request-validation";
import { preparePlannerIndexes } from "./storage-indexes";
import { readWorkflowStatuses, usableWorkflowStatuses } from "./workflow-statuses";

export interface CreateReviewRequestInput {
  ticket: string;
  title: string;
  instructions: string;
  request: unknown;
  reason?: ReviewRequestReason;
  affectedAction?: "implementation" | "merge";
  workspaceId?: string;
  revision?: number;
  sessionId?: string;
  expectedTicketStatusId?: string;
  /** @deprecated Accepted but ignored. Use workspace ownership and revision. Removed in 0.45. */
  expectedAttemptState?: AttemptState;
}

// Attempt handoffs ask for one text answer that describes the decision and the completed action.
export const handoffRequest = {
  kind: "decision",
  questions: [{ id: "result", label: "Decision and completed action", required: true, input: { kind: "text" } }],
} as const;

const readHandoffAttempt = async (ctx: CommandContext, input: CreateReviewRequestInput, ticketId: string) => {
  if (!input.workspaceId) return null;
  const attempt = await readAttempt(ctx.storage, input.workspaceId);
  if (!attempt || attempt.ticketId !== ticketId) {
    throw new Error("The workspace does not own this ticket handoff.");
  }
  if (input.revision !== undefined && attempt.revisions.at(-1)?.revision !== input.revision) {
    throw new Error("Attempt revision changed before the handoff.");
  }
  return attempt;
};

const assertIncompleteTicket = async (ctx: CommandContext, statusId: string | null | undefined) => {
  if (usableWorkflowStatuses(await readWorkflowStatuses(ctx)).completedStatusIds.includes(statusId ?? ""))
    throw new Error("The ticket is complete.");
};

export const createReviewRequest = async (ctx: CommandContext, input: CreateReviewRequestInput) => {
  const ticket = await findTicket(ctx, input.ticket);
  if (!ticket) throw new Error(`Unknown ticket "${input.ticket}"`);
  await assertIncompleteTicket(ctx, ticket.statusId);
  if (input.expectedTicketStatusId !== undefined && ticket.statusId !== input.expectedTicketStatusId) {
    throw new Error("Ticket status changed before the handoff.");
  }
  await readHandoffAttempt(ctx, input, ticket.id);
  const body = parseRequestBody(input.request);
  if (!input.title.trim() || !input.instructions.trim()) throw new Error("A title and instructions are required.");

  // Workflow producers retry; an open request with the same handoff key is the same request.
  if (input.reason) {
    await preparePlannerIndexes(ctx.storage);
    const selected = await ctx.storage.records.query({
      index: "review-request-state",
      fields: ["id"],
      limit: 1,
      orderBy: [
        { field: "requestedAt", direction: "asc" },
        { field: "id", direction: "asc" },
      ],
      where: {
        all: [
          { field: "ticketId", op: "eq", value: ticket.id },
          { field: "valid", op: "eq", value: true },
          { field: "reason", op: "eq", value: input.reason },
          { field: "workspaceId", op: "eq", value: input.workspaceId ?? null },
          { field: "attemptRevision", op: "eq", value: input.revision ?? null },
          { field: "relatedSessionId", op: "eq", value: input.sessionId ?? null },
          {
            not: { exists: { index: "review-outcome-state", on: [{ sourceField: "id", relatedField: "requestKey" }] } },
          },
        ],
      },
    });
    const id = selected.records[0]?.fields.id;
    if (typeof id === "string") return (await readReviewRequest(ctx.storage, id))!;
  }

  const requestId = ctx.storage.ids.create();

  const request: ReviewRequest = {
    id: requestId,
    ticketId: ticket.id,
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    request: body,
    requestedAt: new Date().toISOString(),
    requestedBy: actorFromSource(ctx.source, ctx.invocationId),
    context: {
      reason: input.reason ?? null,
      ...(input.affectedAction ? { affectedAction: input.affectedAction } : {}),
      workspaceId: input.workspaceId ?? null,
      attemptRevision: input.revision ?? null,
      sessionId: null,
      relatedSessionId: input.sessionId ?? null,
    },
  };
  await reviewRequestsCollection(ctx.storage).createIfAbsent(request.id, request);
  await keepOwnedRequest(ctx, request);
  await publishRequestChange(ctx, ticket.id);
  return (await readReviewRequest(ctx.storage, request.id))!;
};
