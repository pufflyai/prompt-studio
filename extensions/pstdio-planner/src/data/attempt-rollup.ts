import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../events";
import { workflowName } from "../timeline/model/workflow";
import { listAttempts } from "./attempt-storage";
import { statusesCollection, ticketsCollection } from "./collections";
import { hasPendingInput, listTicketReviewRequests } from "./review-request-storage";

export const rollUpAttemptTicket = async (
  ctx: Pick<ExtensionContextBase, "storage" | "events" | "sessions">,
  ticketId: string,
) => {
  const { storage } = ctx;
  const ticket = await ticketsCollection(storage).get(ticketId);
  if (!ticket) throw new Error(`Unknown ticket "${ticketId}"`);
  const statuses = await statusesCollection(storage).list();
  const statusId = (name: string) =>
    statuses.find((status) => workflowName(status.name) === workflowName(name))?.id ?? null;
  if (ticket.statusId === statusId("Done")) return ticket;

  const attempts = (await listAttempts(storage)).filter(
    (attempt) => attempt.ticketId === ticketId && attempt.state !== "abandoned",
  );
  if (attempts.length === 0) return ticket;

  let nextStatusId: string | null = null;
  let blockedReason = ticket.blockedReason ?? null;
  const implementing = attempts.filter(
    (attempt) => attempt.state === "implementing" || attempt.state === "changes_requested",
  );
  if (hasPendingInput(await listTicketReviewRequests(storage, ticketId))) {
    nextStatusId = statusId("Blocked");
  } else if (implementing.length) {
    const sessions = await Promise.all(
      implementing.map((attempt) => ctx.sessions.get(attempt.implementationSessionId)),
    );
    if (sessions.some((session) => session?.status === "queued" || session?.status === "in_progress")) {
      nextStatusId = statusId("In Progress");
    } else if (sessions.some((session) => session?.status === "awaiting_input")) {
      nextStatusId = statusId("Blocked");
    } else {
      nextStatusId = statusId("Todo");
    }
    blockedReason = null;
  } else if (
    attempts.some(
      (attempt) => attempt.state === "review_ready" || attempt.state === "reviewing" || attempt.state === "approved",
    )
  ) {
    nextStatusId = statusId("In Review");
    blockedReason = null;
  } else if (attempts.every((attempt) => attempt.state === "blocked")) {
    nextStatusId = statusId("Blocked");
    blockedReason =
      attempts
        .map((attempt) => attempt.blocker?.reason)
        .filter(Boolean)
        .join("; ") || "All attempts blocked";
  }

  if (!nextStatusId || (ticket.statusId === nextStatusId && ticket.blockedReason === blockedReason)) return ticket;
  const next = { ...ticket, statusId: nextStatusId, blockedReason, updatedAt: new Date().toISOString() };
  await ticketsCollection(storage).put(ticket.id, next);
  await ctx.events.emit(plannerTicketsChanged, { ticketId: ticket.id });
  return next;
};

export const refreshAttemptTickets = async (ctx: ExtensionContextBase, sessionId?: string, ticketId?: string) => {
  const [attempts, tickets] = await Promise.all([listAttempts(ctx.storage), ticketsCollection(ctx.storage).list()]);
  const existing = new Set(tickets.map(({ id }) => id));
  const ticketIds = new Set(
    attempts
      .filter(
        (attempt) =>
          existing.has(attempt.ticketId) &&
          (!ticketId || attempt.ticketId === ticketId) &&
          (!sessionId ||
            attempt.implementationSessionId === sessionId ||
            attempt.revisions.some((revision) => revision.reviews.some((review) => review.sessionId === sessionId))),
      )
      .map((attempt) => attempt.ticketId),
  );
  for (const id of ticketIds) await rollUpAttemptTicket(ctx, id);
};
