import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { listAttempts } from "./attempt-storage";
import { statusesCollection, ticketsCollection } from "./collections";

const HUMAN_REQUESTED_OPTION_ID = "default-human-requested-true";

export const rollUpAttemptTicket = async (storage: ExtensionStorageApi, ticketId: string) => {
  const ticket = await ticketsCollection(storage).get(ticketId);
  if (!ticket) throw new Error(`Unknown ticket "${ticketId}"`);
  if ((ticket.tagIds ?? []).includes(HUMAN_REQUESTED_OPTION_ID)) return ticket;

  const statuses = await statusesCollection(storage).list();
  const statusId = (name: string) =>
    statuses.find((status) => status.name.trim().toLowerCase() === name.toLowerCase())?.id ?? null;
  if (ticket.statusId === statusId("Done")) return ticket;

  const attempts = (await listAttempts(storage)).filter(
    (attempt) => attempt.ticketId === ticketId && attempt.state !== "abandoned",
  );
  if (attempts.length === 0) return ticket;

  let nextStatusId: string | null = null;
  let blockedReason = ticket.blockedReason ?? null;
  if (attempts.some((attempt) => attempt.state === "implementing" || attempt.state === "changes_requested")) {
    nextStatusId = statusId("In Progress");
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
  return next;
};
