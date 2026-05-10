import type { SessionStatus } from "@/features/sessions/types";
import type { Ticket, TicketAttempt } from "@/features/ticket-list/types";

const SETTLED_STATUSES = new Set<SessionStatus>(["completed", "failed", "cancelled", "disconnected"]);
const RUNNING_STATUS: SessionStatus = "in_progress";

export const isSessionSettled = (status: SessionStatus | null) => status !== null && SETTLED_STATUSES.has(status);

const findLatestAttempt = (attempts: TicketAttempt[]) => {
  let latestAttempt = attempts[0] ?? null;

  for (const attempt of attempts) {
    if (!latestAttempt || shouldReplaceLatestAttempt(latestAttempt, attempt)) {
      latestAttempt = attempt;
    }
  }

  return latestAttempt;
};

const getAttemptSessionTime = (attempt: TicketAttempt) => attempt.sessionCreatedAt ?? attempt.updatedAt;

const hasSession = (attempt: TicketAttempt) => attempt.sessionStatus !== null;

const shouldReplaceLatestAttempt = (current: TicketAttempt, candidate: TicketAttempt) => {
  if (hasSession(current) !== hasSession(candidate)) {
    return hasSession(candidate);
  }

  const currentIsRunning = current.sessionStatus === RUNNING_STATUS;
  const candidateIsRunning = candidate.sessionStatus === RUNNING_STATUS;

  if (currentIsRunning !== candidateIsRunning) {
    return candidateIsRunning;
  }

  return Date.parse(getAttemptSessionTime(candidate)) > Date.parse(getAttemptSessionTime(current));
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
  return sessionStatus ?? undefined;
};
