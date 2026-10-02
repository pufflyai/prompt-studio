import type { AttemptReadinessResult } from "./attempt-readiness";

type AttemptWait = Extract<AttemptReadinessResult, { decision: "wait" }>;

export interface AttemptCapacity {
  running: number;
  limit: number;
}

const listTickets = (ids: string[]) => (ids.length > 1 ? `${ids.slice(0, -1).join(", ")} and ${ids.at(-1)}` : ids[0]);

const capacityReason = ({ running, limit }: AttemptCapacity) => {
  if (limit === 0) return "this project allows no attempts. Raise Maximum in-progress tickets in the Planner settings.";
  const attempts = running === 1 ? "1 attempt is" : `${running} attempts are`;
  return `${attempts} running, and this project allows ${limit} at a time. Wait for one to finish, or raise Maximum in-progress tickets in the Planner settings.`;
};

const waitReason = (ticket: string, wait: AttemptWait, capacity: AttemptCapacity) => {
  const [dependency] = wait.dependencyIds;
  switch (wait.reason) {
    // The blocking ticket can sit further down the depends_on chain, so the message says
    // "waits on" rather than claiming a direct dependency.
    case "dependency-not-ready":
      return `it waits on ${dependency}, which is not done and has no attempt to build on.`;
    case "dependency-missing":
      return `it depends on ${dependency}, which no longer exists. Remove it from depends_on.`;
    case "dependency-cycle":
      return "its dependencies form a loop. Remove one dependency to break it.";
    case "ambiguous-dependency-attempt":
      return `${dependency} has more than one approved attempt. Choose the one ${ticket} should build on.`;
    case "divergent-dependency-attempts":
      return `the attempts for ${listTickets(wait.dependencyIds)} don't build on each other. Merge one of them first.`;
    case "capacity-full":
      return capacityReason(capacity);
  }
};

// Run attempt shows this text to the person who started it, so every message names
// what blocks the ticket and what to do next.
export const attemptWaitMessage = (ticket: string, wait: AttemptWait, capacity: AttemptCapacity) =>
  `${ticket} can't start: ${waitReason(ticket, wait, capacity)}`;
