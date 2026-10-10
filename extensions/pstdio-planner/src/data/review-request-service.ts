// Settle review requests and keep the Review Needed flag in step with the requests that are still open.
import { type CommandContext, workbenchPanels } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../events";
import { actorFromSource } from "./attempt-actors";
import { ticketsCollection } from "./collections";
import {
  deleteTicketReviewRequests,
  hasPendingInput,
  listTicketReviewRequests,
  readReviewRequest,
  reviewOutcomesCollection,
  reviewRequestsCollection,
} from "./review-request-storage";
import type { ReviewOutcome, ReviewRequestView } from "./review-request-types";
import { validateResponse } from "./review-request-validation";
import { seedDefaultTags } from "./seed";

export const HUMAN_REQUESTED_OPTION_ID = "default-human-requested-true";

type StorageContext = Pick<CommandContext, "storage">;

// The flag is a projection of open requests. Every lifecycle change rewrites it from the stored requests,
// so an interrupted earlier update is repaired by the next one.
export const syncReviewNeededFlag = async (ctx: StorageContext, ticketId: string) => {
  const pending = hasPendingInput(await listTicketReviewRequests(ctx.storage, ticketId));
  if (pending) await seedDefaultTags(ctx.storage);
  const ticket = await ticketsCollection(ctx.storage).get(ticketId);
  if (!ticket) return;
  const tagIds = ticket.tagIds ?? [];
  if (tagIds.includes(HUMAN_REQUESTED_OPTION_ID) === pending) return;
  const next = pending
    ? [...tagIds, HUMAN_REQUESTED_OPTION_ID]
    : tagIds.filter((id) => id !== HUMAN_REQUESTED_OPTION_ID);
  await ticketsCollection(ctx.storage).put(ticket.id, { ...ticket, tagIds: next, updatedAt: new Date().toISOString() });
};

// A write that raced with ticket deletion removes its own records so no orphan request remains.
export const keepOwnedRequest = async (ctx: StorageContext, request: Pick<ReviewRequestView, "id" | "ticketId">) => {
  if (await ticketsCollection(ctx.storage).get(request.ticketId)) return;
  await deleteTicketReviewRequests(ctx.storage, request.ticketId);
  // Cleanup may have run before this write, so remove this request's records by ID as well.
  await reviewRequestsCollection(ctx.storage).delete(request.id);
  await reviewOutcomesCollection(ctx.storage).delete(request.id);
  throw new Error("The ticket was removed.");
};

export const publishRequestChange = async (ctx: CommandContext, ticketId: string) => {
  await syncReviewNeededFlag(ctx, ticketId);
  await ctx.events.emit(plannerTicketsChanged, { ticketId });
};

const settledMessage = (request: ReviewRequestView) =>
  `Request ${request.id} is already ${request.state}. ${request.outcomeText ?? ""}`.trim();

const openRequest = async (ctx: CommandContext, requestId: string, verb: string) => {
  if (ctx.source === "schedule" || ctx.source === "automation" || ctx.source === "event") {
    throw new Error(`Automation cannot ${verb} a review request.`);
  }
  const request = await readReviewRequest(ctx.storage, requestId);
  if (!request) throw new Error(`Unknown review request "${requestId}".`);
  // A request stays answerable after its ticket is done, because a merge can finish the ticket first.
  if (!(await ticketsCollection(ctx.storage).get(request.ticketId))) throw new Error("The ticket was removed.");
  if (request.state !== "open") throw new Error(settledMessage(request));
  return request;
};

// One atomic insert keyed by the request ID decides which competing answer or cancellation wins.
const settle = async (ctx: CommandContext, request: ReviewRequestView, outcome: ReviewOutcome) => {
  if (
    !(await reviewOutcomesCollection(ctx.storage).createIfAbsent(request.id, { ...outcome, requestId: request.id }))
  ) {
    const current = await readReviewRequest(ctx.storage, request.id);
    throw new Error(current ? settledMessage(current) : "The request was removed.");
  }
  await keepOwnedRequest(ctx, request);
  await publishRequestChange(ctx, request.ticketId);
  return (await readReviewRequest(ctx.storage, request.id)) as ReviewRequestView;
};

export const answerReviewRequest = async (ctx: CommandContext, requestId: string, response: unknown) => {
  const request = await openRequest(ctx, requestId, "answer");
  return settle(ctx, request, {
    kind: "answered",
    at: new Date().toISOString(),
    by: actorFromSource(ctx.source, ctx.invocationId),
    response: validateResponse(request.request, response),
  });
};

export const cancelReviewRequest = async (ctx: CommandContext, requestId: string, reason: string) => {
  if (!reason.trim()) throw new Error("A cancellation reason is required.");
  const request = await openRequest(ctx, requestId, "cancel");
  return settle(ctx, request, {
    kind: "cancelled",
    at: new Date().toISOString(),
    by: actorFromSource(ctx.source, ctx.invocationId),
    reason: reason.trim(),
  });
};

// Opening the linked chat helps with the request; it records nothing.
export const openReviewRequestSession = async (ctx: CommandContext, requestId: string) => {
  const request = await readReviewRequest(ctx.storage, requestId);
  if (!request) throw new Error(`Unknown review request "${requestId}".`);
  const session = await ctx.sessions.get(request.context.sessionId);
  if (!session) throw new Error("The linked chat session was removed.");
  ctx.navigation.open({
    kind: "panel",
    panel: workbenchPanels.projectSession,
    open: "preview",
    resource: { type: "session", id: session.id, extensionId: "pstdio", label: session.title },
  });
  return { type: "session" as const, id: session.id, title: session.title };
};
