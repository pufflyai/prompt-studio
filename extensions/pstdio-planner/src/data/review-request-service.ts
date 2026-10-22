// Settle review requests and notify readers to derive the current Needs attention flag.
import { type CommandContext, workbenchPanels } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../events";
import { actorFromSource } from "./attempt-actors";
import { ticketsCollection } from "./collections";
import { getReviewRequestSession } from "./review-request-session";
import {
  deleteTicketReviewRequests,
  readReviewRequest,
  reviewOutcomesCollection,
  reviewRequestsCollection,
} from "./review-request-storage";
import type { ReviewOutcome, ReviewRequestView } from "./review-request-types";
import { validateResponse } from "./review-request-validation";

type StorageContext = Pick<CommandContext, "storage">;

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
  await ctx.events.emit(plannerTicketsChanged, { ticketId });
};

const settledMessage = (request: ReviewRequestView) =>
  `Request ${request.id} is already ${request.state}. ${request.outcomeText ?? ""}`.trim();

const ownedRequest = async (ctx: CommandContext, requestId: string, verb: string) => {
  if (ctx.source === "schedule" || ctx.source === "automation" || ctx.source === "event") {
    throw new Error(`Automation cannot ${verb} a review request.`);
  }
  const request = await readReviewRequest(ctx.storage, requestId);
  if (!request) throw new Error(`Unknown review request "${requestId}".`);
  // A request stays answerable after its ticket is done, because a merge can finish the ticket first.
  if (!(await ticketsCollection(ctx.storage).get(request.ticketId))) throw new Error("The ticket was removed.");
  return request;
};

// The first answer or cancellation wins atomically. Later decision edits replace only that answer.
const settle = async (ctx: CommandContext, request: ReviewRequestView, outcome: ReviewOutcome) => {
  if (request.state === "answered") {
    await reviewOutcomesCollection(ctx.storage).update(request.id, { ...outcome, requestId: request.id });
  } else if (
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
  const request = await ownedRequest(ctx, requestId, "answer");
  if (request.state !== "open" && !(request.state === "answered" && request.request.kind === "decision")) {
    throw new Error(settledMessage(request));
  }
  return settle(ctx, request, {
    kind: "answered",
    at: new Date().toISOString(),
    by: actorFromSource(ctx.source, ctx.invocationId),
    response: validateResponse(request.request, response),
  });
};

export const cancelReviewRequest = async (ctx: CommandContext, requestId: string, reason: string) => {
  if (!reason.trim()) throw new Error("A cancellation reason is required.");
  const request = await ownedRequest(ctx, requestId, "cancel");
  if (request.state !== "open") throw new Error(settledMessage(request));
  return settle(ctx, request, {
    kind: "cancelled",
    at: new Date().toISOString(),
    by: actorFromSource(ctx.source, ctx.invocationId),
    reason: reason.trim(),
  });
};

// Opening a conversation may start an agent, but never answers the request.
export const openReviewRequestSession = async (ctx: CommandContext, requestId: string) => {
  const session = await getReviewRequestSession(ctx, requestId);
  ctx.navigation.open({
    kind: "panel",
    panel: workbenchPanels.projectSession,
    open: "preview",
    resource: { type: "session", id: session.id, extensionId: "pstdio", label: session.title },
  });
  return { type: "session" as const, id: session.id, title: session.title };
};
