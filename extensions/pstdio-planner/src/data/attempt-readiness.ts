import type { AttemptRecord, TicketAttemptSelection } from "./attempt-types";
import { hasPendingImplementationInput } from "./implementation-input";
import { prerequisiteClosure } from "./prerequisite-closure";
import type { TicketReviewRequests } from "./review-request-types";
import { normalizeTicketDependencies } from "./ticket-dependencies";

export interface AttemptReadinessTicket {
  id: string;
  shorthand: string;
  statusId: string | null;
  dependsOn?: string | string[] | null;
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
        | "capacity-full"
        | "human-input-needed";
      dependencyIds: string[];
      integrationHeads?: { workspaceId: string; headSha: string }[];
      baseHeadSha?: string;
    };

interface ResolveAttemptReadinessInput {
  requests: Map<string, TicketReviewRequests>;
  /** @deprecated Submitted commit evidence replaces review lifecycle gating. */
  requireMergedDependencies?: boolean;
  mergedTicketIds?: Set<string>;
  dependencyReview?: "approved" | "submitted";
  activeWorkspaceIds?: Set<string>;
  retiredWorkspaceIds?: Set<string>;
  target: string;
  tickets: AttemptReadinessTicket[];
  attempts: AttemptRecord[];
  selections: TicketAttemptSelection[];
  doneStatusIds: Set<string>;
  mainHeadSha: string;
  activeImplementationCount: number;
  maxInProgress: number;
  isAncestor(baseSha: string, headSha: string): Promise<boolean>;
}

const latestHead = (attempt: AttemptRecord) => attempt.revisions.at(-1)?.headSha ?? null;

export const findPendingPrerequisites = (
  target: AttemptReadinessTicket,
  byRef: Map<string, AttemptReadinessTicket>,
  requests: ResolveAttemptReadinessInput["requests"],
  requireMergedDependencies = false,
) => {
  // Completion chooses the attempt base; it cannot answer requests on any prerequisite.
  const prerequisites = new Map<string, AttemptReadinessTicket>();
  const remaining = [target];
  while (remaining.length) {
    const ticket = remaining.pop()!;
    if (prerequisites.has(ticket.id)) continue;
    prerequisites.set(ticket.id, ticket);
    for (const ref of normalizeTicketDependencies(ticket.dependsOn)) {
      const dependency = byRef.get(ref);
      if (dependency) remaining.push(dependency);
    }
  }
  return [...prerequisites.values()].filter((ticket) =>
    hasPendingImplementationInput(requests.get(ticket.id) ?? { requests: [], errors: [] }, requireMergedDependencies),
  );
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

  if (input.activeImplementationCount >= input.maxInProgress) {
    return { decision: "wait", reason: "capacity-full", dependencyIds: [] };
  }

  const closure = prerequisiteClosure(target, byRef, (dependency) =>
    input.requireMergedDependencies
      ? Boolean(input.mergedTicketIds?.has(dependency.id))
      : input.doneStatusIds.has(dependency.statusId ?? ""),
  );
  if (closure.missing) return { decision: "wait", reason: "dependency-missing", dependencyIds: [closure.missing] };
  if (closure.cycle) return { decision: "wait", reason: "dependency-cycle", dependencyIds: [closure.cycle] };
  const unresolvedTickets = closure.tickets;
  const pending = findPendingPrerequisites(target, byRef, input.requests, input.requireMergedDependencies);
  if (pending.length)
    return { decision: "wait", reason: "human-input-needed", dependencyIds: pending.map((ticket) => ticket.shorthand) };
  if (unresolvedTickets.length === 0) {
    return {
      decision: "ready",
      mode: "main",
      baseWorkspaceId: null,
      baseHeadSha: input.mainHeadSha,
      dependencyAttemptIds: [],
    };
  }

  if (input.requireMergedDependencies)
    return {
      decision: "wait",
      reason: "dependency-not-ready",
      dependencyIds: unresolvedTickets.map((ticket) => ticket.shorthand),
    };

  const selectedAttempts: AttemptRecord[] = [];
  for (const dependency of unresolvedTickets) {
    const selection = input.selections.find((candidate) => candidate.ticketId === dependency.id);
    const attempts = input.attempts.filter((attempt) => attempt.ticketId === dependency.id);
    const eligible = (attempt: AttemptRecord) =>
      latestHead(attempt) !== null &&
      !input.retiredWorkspaceIds?.has(attempt.workspaceId) &&
      !input.activeWorkspaceIds?.has(attempt.workspaceId);
    const selected = attempts.filter(
      (attempt) => (!selection || attempt.workspaceId === selection.workspaceId) && eligible(attempt),
    );

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
      baseHeadSha: input.mainHeadSha,
      integrationHeads: selectedAttempts.map((attempt) => ({
        workspaceId: attempt.workspaceId,
        headSha: latestHead(attempt)!,
      })),
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
