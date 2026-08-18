import type { AttemptRecord, TicketAttemptSelection } from "./attempt-types";
import { normalizeTicketDependencies } from "./ticket-dependencies";

export interface AttemptReadinessTicket {
  id: string;
  shorthand: string;
  statusId: string | null;
  dependsOn?: string | string[] | null;
  parallelizable?: string | null;
}

export type AttemptReadinessResult =
  | {
      decision: "ready";
      mode: "main" | "stacked";
      baseWorkspaceId: string | null;
      baseHeadSha: string;
      dependencyAttemptIds: string[];
    }
  | {
      decision: "wait";
      reason:
        | "dependency-not-ready"
        | "dependency-cycle"
        | "dependency-missing"
        | "ambiguous-dependency-attempt"
        | "divergent-dependency-attempts"
        | "non-parallel-attempt-active"
        | "capacity-full";
      dependencyIds: string[];
    };

interface ResolveAttemptReadinessInput {
  target: string;
  tickets: AttemptReadinessTicket[];
  attempts: AttemptRecord[];
  selections: TicketAttemptSelection[];
  doneStatusIds: Set<string>;
  mainHeadSha: string;
  hasActiveImplementation: boolean;
  activeImplementationCount?: number;
  maxInProgress?: number;
  isAncestor(baseSha: string, headSha: string): Promise<boolean>;
}

const latestHead = (attempt: AttemptRecord) => attempt.revisions.at(-1)?.headSha ?? null;

const isSelectedAttemptViable = (attempt: AttemptRecord) => {
  return attempt.state !== "blocked" && attempt.state !== "abandoned" && latestHead(attempt) !== null;
};

const isApprovedAttempt = (attempt: AttemptRecord) => attempt.state === "approved" && latestHead(attempt) !== null;

const capacityWait = (input: ResolveAttemptReadinessInput, target: AttemptReadinessTicket) => {
  if (target.parallelizable?.trim().toLowerCase() === "no" && input.hasActiveImplementation) {
    return { decision: "wait" as const, reason: "non-parallel-attempt-active" as const, dependencyIds: [] };
  }
  if (
    input.maxInProgress !== undefined &&
    input.activeImplementationCount !== undefined &&
    input.activeImplementationCount >= input.maxInProgress
  ) {
    return { decision: "wait" as const, reason: "capacity-full" as const, dependencyIds: [] };
  }
  return null;
};

export const resolveAttemptReadiness = async (input: ResolveAttemptReadinessInput): Promise<AttemptReadinessResult> => {
  const byRef = new Map(
    input.tickets.flatMap((ticket) => [
      [ticket.id, ticket],
      [ticket.shorthand, ticket],
    ]),
  );
  const target = byRef.get(input.target);
  if (!target) return { decision: "wait", reason: "dependency-missing", dependencyIds: [input.target] };

  const wait = capacityWait(input, target);
  if (wait) return wait;

  const unresolved = new Map<string, AttemptReadinessTicket>();
  const visited = new Set<string>();
  const visiting = new Set<string>();
  let missing: string | null = null;
  let cycle: string | null = null;

  const visit = (ticket: AttemptReadinessTicket) => {
    if (visited.has(ticket.id) || missing || cycle) return;
    if (visiting.has(ticket.id)) {
      cycle = ticket.shorthand;
      return;
    }
    visiting.add(ticket.id);
    for (const dependencyRef of normalizeTicketDependencies(ticket.dependsOn)) {
      const dependency = byRef.get(dependencyRef);
      if (!dependency) {
        missing = dependencyRef;
        break;
      }
      if (visiting.has(dependency.id)) {
        cycle = dependency.shorthand;
        break;
      }
      if (!input.doneStatusIds.has(dependency.statusId ?? "")) {
        visit(dependency);
        unresolved.set(dependency.id, dependency);
      }
    }
    visiting.delete(ticket.id);
    visited.add(ticket.id);
  };

  visit(target);
  if (missing) return { decision: "wait", reason: "dependency-missing", dependencyIds: [missing] };
  if (cycle) return { decision: "wait", reason: "dependency-cycle", dependencyIds: [cycle] };
  const unresolvedTickets = [...unresolved.values()];
  if (unresolvedTickets.length === 0) {
    return {
      decision: "ready",
      mode: "main",
      baseWorkspaceId: null,
      baseHeadSha: input.mainHeadSha,
      dependencyAttemptIds: [],
    };
  }

  const selectedAttempts: AttemptRecord[] = [];
  for (const dependency of unresolvedTickets) {
    const selection = input.selections.find((candidate) => candidate.ticketId === dependency.id);
    const attempts = input.attempts.filter((attempt) => attempt.ticketId === dependency.id);
    const selected = selection
      ? attempts.filter((attempt) => attempt.workspaceId === selection.workspaceId && isSelectedAttemptViable(attempt))
      : attempts.filter(isApprovedAttempt);

    if (selected.length === 0) {
      return {
        decision: "wait",
        reason: "dependency-not-ready",
        dependencyIds: [dependency.shorthand],
      };
    }
    if (selected.length > 1) {
      return {
        decision: "wait",
        reason: "ambiguous-dependency-attempt",
        dependencyIds: [dependency.shorthand],
      };
    }
    if (!selectedAttempts.some((attempt) => attempt.workspaceId === selected[0]!.workspaceId)) {
      selectedAttempts.push(selected[0]!);
    }
  }

  const tips: AttemptRecord[] = [];
  for (const candidate of selectedAttempts) {
    const candidateHead = latestHead(candidate)!;
    const containsEveryHead = await Promise.all(
      selectedAttempts.map((attempt) => input.isAncestor(latestHead(attempt)!, candidateHead)),
    );
    if (containsEveryHead.every(Boolean)) tips.push(candidate);
  }

  if (tips.length !== 1) {
    return {
      decision: "wait",
      reason: "divergent-dependency-attempts",
      dependencyIds: unresolvedTickets.map((dependency) => dependency.shorthand),
    };
  }

  return {
    decision: "ready",
    mode: "stacked",
    baseWorkspaceId: tips[0]!.workspaceId,
    baseHeadSha: latestHead(tips[0]!)!,
    dependencyAttemptIds: selectedAttempts.map((attempt) => attempt.workspaceId),
  };
};
