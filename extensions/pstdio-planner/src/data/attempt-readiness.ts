import type { AttemptRecord, TicketAttemptSelection } from "./attempt-types";
import type { DependencyDelivery } from "./dependency-deliveries";
import { hasPendingImplementationInput } from "./implementation-input";
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
    };

interface ResolveAttemptReadinessInput {
  requests: Map<string, TicketReviewRequests>;
  activeImplementationWorkspaceIds?: Set<string>;
  retiredWorkspaceIds?: Set<string>;
  requireMergedDependencies?: boolean;
  target: string;
  tickets: AttemptReadinessTicket[];
  attempts: AttemptRecord[];
  selections: TicketAttemptSelection[];
  doneStatusIds: Set<string>;
  mainHeadSha: string;
  mergedHeads: Map<string, string[]>;
  dependencyDeliveries: Map<string, DependencyDelivery>;
  activeImplementationCount: number;
  maxInProgress: number;
  isAncestor(baseSha: string, headSha: string): Promise<boolean>;
}

const latestHead = (attempt: AttemptRecord) => attempt.revisions.at(-1)?.headSha ?? null;

type DependencyInput = Omit<ResolveAttemptReadinessInput, "activeImplementationCount" | "maxInProgress">;
// A submitted commit is the dependency evidence. Review verdicts are optional and never gate stacking.
const isDependencyAttemptReady = (input: DependencyInput, attempt: AttemptRecord) =>
  latestHead(attempt) !== null &&
  !input.retiredWorkspaceIds?.has(attempt.workspaceId) &&
  !input.activeImplementationWorkspaceIds?.has(attempt.workspaceId);

const selectDependencyAttempt = async (input: DependencyInput, dependency: AttemptReadinessTicket) => {
  const selection = input.selections.find((candidate) => candidate.ticketId === dependency.id);
  const attempts = input.attempts.filter((attempt) => attempt.ticketId === dependency.id);
  const done = input.doneStatusIds.has(dependency.statusId ?? "");
  const delivery = input.dependencyDeliveries.get(dependency.id);
  const active = attempts.some((attempt) => input.activeImplementationWorkspaceIds?.has(attempt.workspaceId));
  const candidates = attempts.filter(
    (attempt) =>
      (!selection || attempt.workspaceId === selection.workspaceId) && isDependencyAttemptReady(input, attempt),
  );
  if (delivery && active)
    return {
      decision: "wait",
      reason: "dependency-not-ready",
      dependencyIds: [dependency.shorthand],
    } satisfies AttemptReadinessResult;
  if (candidates.length > 1)
    return {
      decision: "wait",
      reason: "ambiguous-dependency-attempt",
      dependencyIds: [dependency.shorthand],
    } satisfies AttemptReadinessResult;
  const selectedAttempt = attempts.find(({ workspaceId }) => workspaceId === selection?.workspaceId);
  if (selection && !selectedAttempt)
    return {
      decision: "wait",
      reason: "dependency-not-ready",
      dependencyIds: [dependency.shorthand],
    } satisfies AttemptReadinessResult;
  const selectedHead = selectedAttempt ? latestHead(selectedAttempt) : null;
  if (
    done &&
    delivery?.mergeSha &&
    (!selection || (selectedHead !== null && selectedHead === delivery.headSha)) &&
    (await input.isAncestor(delivery.mergeSha, input.mainHeadSha))
  )
    return null;
  // A completed human task may have no code artifact. Managed code must still reach this base.
  if (done && attempts.length === 0 && !delivery) return null;
  const selected = candidates.filter(
    (attempt) => !delivery || (delivery.headSha !== null && latestHead(attempt) === delivery.headSha),
  );
  if (selected.length === 0)
    return {
      decision: "wait",
      reason: "dependency-not-ready",
      dependencyIds: [dependency.shorthand],
    } satisfies AttemptReadinessResult;
  const head = latestHead(selected[0]!)!;
  const integrated = await Promise.all(
    [head, ...(input.mergedHeads.get(head) ?? [])].map((commit) => input.isAncestor(commit, input.mainHeadSha)),
  );
  if (integrated.some(Boolean)) return null;
  return selected[0]!;
};

const selectDependencyAttempts = async (input: DependencyInput, dependencies: AttemptReadinessTicket[]) => {
  const selectedAttempts: AttemptRecord[] = [];
  for (const dependency of dependencies) {
    const selected = await selectDependencyAttempt(input, dependency);
    if (!selected) continue;
    if ("decision" in selected) return selected;
    if (!selectedAttempts.some((attempt) => attempt.workspaceId === selected.workspaceId))
      selectedAttempts.push(selected);
  }
  return selectedAttempts;
};

export const findPendingPrerequisites = (
  target: AttemptReadinessTicket,
  byRef: Map<string, AttemptReadinessTicket>,
  requests: ResolveAttemptReadinessInput["requests"],
  requireMergedDependencies = false,
) => {
  // Requests still pause dependent work after the prerequisite code is integrated.
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
  if (input.activeImplementationCount >= input.maxInProgress) {
    return { decision: "wait", reason: "capacity-full", dependencyIds: [] };
  }
  return resolveAttemptDependencies(input);
};

export const resolveAttemptDependencies = async (input: DependencyInput): Promise<AttemptReadinessResult> => {
  const byRef = new Map(
    input.tickets.flatMap((ticket) => [
      [ticket.id, ticket],
      [ticket.shorthand, ticket],
    ]),
  );
  const target = byRef.get(input.target);
  if (!target) return { decision: "wait", reason: "dependency-missing", dependencyIds: [input.target] };

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
      visit(dependency);
      unresolved.set(dependency.id, dependency);
    }
    visiting.delete(ticket.id);
    visited.add(ticket.id);
  };

  visit(target);
  if (missing) return { decision: "wait", reason: "dependency-missing", dependencyIds: [missing] };
  if (cycle) return { decision: "wait", reason: "dependency-cycle", dependencyIds: [cycle] };
  const unresolvedTickets = [...unresolved.values()];
  const pending = findPendingPrerequisites(target, byRef, input.requests, input.requireMergedDependencies);
  if (pending.length)
    return { decision: "wait", reason: "human-input-needed", dependencyIds: pending.map((ticket) => ticket.shorthand) };
  const selectedAttempts = await selectDependencyAttempts(input, unresolvedTickets);
  if (!Array.isArray(selectedAttempts)) return selectedAttempts;

  if (selectedAttempts.length === 0) {
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
      dependencyIds: unresolvedTickets
        .filter(({ id }) => selectedAttempts.some(({ ticketId }) => ticketId === id))
        .map(({ shorthand }) => shorthand),
    };

  const tips: AttemptRecord[] = [];
  for (const candidate of selectedAttempts) {
    const candidateHead = latestHead(candidate)!;
    const containsEveryHead = await Promise.all(
      selectedAttempts.map((attempt) => input.isAncestor(latestHead(attempt)!, candidateHead)),
    );
    if (containsEveryHead.every(Boolean) && (await input.isAncestor(input.mainHeadSha, candidateHead)))
      tips.push(candidate);
  }

  if (tips.length === 0) {
    return {
      decision: "ready",
      mode: "stacked",
      baseWorkspaceId: null,
      baseHeadSha: input.mainHeadSha,
      dependencyAttemptIds: selectedAttempts.map((attempt) => attempt.workspaceId),
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
