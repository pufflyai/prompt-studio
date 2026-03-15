import type { Ticket, TicketAttempt } from "@/features/ticket-list/types";

const findLatestAttempt = (attempts: TicketAttempt[]) => {
  let latestAttempt = attempts[0] ?? null;

  for (const attempt of attempts) {
    if (!latestAttempt || Date.parse(attempt.updatedAt) > Date.parse(latestAttempt.updatedAt)) {
      latestAttempt = attempt;
    }
  }

  return latestAttempt;
};

export const buildLatestAttemptsByTicketId = (tickets: Ticket[]) => {
  const latestAttemptsByTicketId = new Map<string, TicketAttempt>();

  for (const ticket of tickets) {
    const latestAttempt = findLatestAttempt(ticket.attempts ?? []);
    if (!latestAttempt) continue;
    latestAttemptsByTicketId.set(ticket.id, latestAttempt);
  }

  return latestAttemptsByTicketId;
};

export const toSessionIndicatorStatus = (sessionStatus: TicketAttempt["sessionStatus"]) => {
  if (sessionStatus === "cancelled") return "failed";
  return sessionStatus ?? undefined;
};
