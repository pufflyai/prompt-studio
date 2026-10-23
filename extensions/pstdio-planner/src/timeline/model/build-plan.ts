// Turn the resolved execution order into deadline sections with steps, tags, blockers, and risk flags.

import type { AttemptRecord } from "../../data/attempt-types";
import { withIndependentBlockers } from "../../data/dependency-blockers";
import { hasPendingInput } from "../../data/review-request-storage";
import type { TicketReviewRequests } from "../../data/review-request-types";
import { emptyWorkflowStatuses, type WorkflowStatusSelections } from "../../data/workflow-statuses";
import type { Deadline, PlanFlag, PlanLink, PlanTag, StoredPlan } from "../contracts";
import { dependencyIds, type PlannerStatus, type PlannerTicket, ticketTarget } from "../planner";
import { daysBetween } from "./days";
import { projectPace } from "./milestone-eta";
import { summarizeSection } from "./section-summary";
import { ticketState } from "./state";

// Deadlines inside this many days are shown as due soon.
const dueSoonDays = 7;

export interface PlanInput {
  attempts?: Pick<AttemptRecord, "ticketId" | "createdAt">[];
  now?: number;
  workflow?: WorkflowStatusSelections;
  requests?: Map<string, TicketReviewRequests>;
  gates?: Set<string>;
  // The Track property that readTrack resolved. Without it, rows have no track.
  track?: PlanTag;
  tickets: PlannerTicket[];
  statuses: PlannerStatus[];
  tags: PlanTag[];
  // A plan completed by resolvePlan, so every ticket has exactly one entry.
  plan: StoredPlan;
  today: string;
}

interface PlanIndex {
  workflow: WorkflowStatusSelections;
  tickets: Map<string, PlannerTicket>;
  statuses: Map<string, PlannerStatus>;
  steps: Map<string, number>;
  dependents: Map<string, PlannerTicket[]>;
  today: string;
  trackOptionIds: Set<string>;
  requests: Map<string, TicketReviewRequests>;
  gates: Set<string>;
}

const isDone = (ticket: PlannerTicket, index: PlanIndex) =>
  index.workflow.completedStatusIds.includes(ticket.statusId ?? "");

const link = (ticket: PlannerTicket, index: PlanIndex) => ({
  id: ticket.id,
  shorthand: ticket.shorthand,
  done: isDone(ticket, index),
});

const dependencies = (ticket: PlannerTicket, index: PlanIndex) =>
  dependencyIds(ticket.dependsOn).flatMap((id) => index.tickets.get(id) ?? []);

// Execution order runs through the deadlines by date, then through unscheduled work.
function executionOrder(plan: StoredPlan) {
  const groups = [...plan.deadlines.map(({ id }) => id), null];
  return groups.map((deadlineId) => ({
    deadline: plan.deadlines.find(({ id }) => id === deadlineId),
    ticketIds: plan.order.filter((entry) => entry.deadlineId === deadlineId).map(({ ticketId }) => ticketId),
  }));
}

function indexInput(input: PlanInput, groups: ReturnType<typeof executionOrder>) {
  const dependents = new Map<string, PlannerTicket[]>();
  for (const ticket of input.tickets) {
    for (const id of dependencyIds(ticket.dependsOn)) {
      dependents.set(id, [...(dependents.get(id) ?? []), ticket]);
    }
  }

  return {
    workflow: input.workflow ?? emptyWorkflowStatuses(),
    tickets: new Map(input.tickets.map((ticket) => [ticket.id, ticket])),
    statuses: new Map(input.statuses.map((status) => [status.id, status])),
    steps: new Map(groups.flatMap(({ ticketIds }) => ticketIds).map((id, position) => [id, position + 1])),
    dependents,
    today: input.today,
    requests: input.requests ?? new Map(),
    gates: input.gates ?? new Set(),
    trackOptionIds: new Set(input.track?.options.map(({ id }) => id)),
  };
}

const requestsFor = (ticket: PlannerTicket, index: PlanIndex) =>
  index.requests.get(ticket.id) ?? { requests: [], errors: [] };

// Only open or unreadable requests ask for input.
const needsHuman = (ticket: PlannerTicket, index: PlanIndex) => hasPendingInput(requestsFor(ticket, index));

// Walk up the parent chain once; a cycle stops at the first repeated ticket.
function ancestors(ticket: PlannerTicket, index: PlanIndex) {
  const chain: PlannerTicket[] = [];
  const seen = new Set([ticket.id]);
  let parent = ticket.parentId ? index.tickets.get(ticket.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    chain.unshift(parent);
    parent = parent.parentId ? index.tickets.get(parent.parentId) : undefined;
  }

  return chain.map((ticket) => link(ticket, index));
}

function flagsFor(ticket: PlannerTicket, deadline: Deadline | undefined, late: PlanLink[], index: PlanIndex) {
  if (isDone(ticket, index)) {
    return [];
  }

  const flags: PlanFlag[] = [];
  const waiting = dependencies(ticket, index).some((dependency) => !isDone(dependency, index));
  if (deadline && deadline.date < index.today) {
    flags.push("overdue");
  } else if (deadline && daysBetween(index.today, deadline.date) <= dueSoonDays) {
    flags.push("due-soon");
  }

  if (needsHuman(ticket, index)) {
    flags.push("human-needed");
  } else if (
    !waiting &&
    (index.workflow.blockedStatusIds.includes(ticket.statusId ?? "") || ticket.blockedReason?.trim())
  ) {
    flags.push("blocked");
  }

  if (waiting) {
    flags.push("waiting");
  }

  if (late.length > 0) {
    flags.push("out-of-order");
  }

  return flags;
}

function toRow(ticket: PlannerTicket, deadline: Deadline | undefined, index: PlanIndex) {
  const step = index.steps.get(ticket.id) ?? 0;
  const dependsOn = dependencies(ticket, index);
  const late = dependsOn.filter(
    (dependency) => !isDone(dependency, index) && (index.steps.get(dependency.id) ?? 0) > step,
  );
  const blockedReason = isDone(ticket, index) ? undefined : ticket.blockedReason?.trim() || undefined;
  const { requests, errors } = requestsFor(ticket, index);
  const flags = flagsFor(
    ticket,
    deadline,
    late.map((ticket) => link(ticket, index)),
    index,
  );
  const humanNeeded = flags.includes("human-needed");
  const gate = index.gates.has(ticket.id);
  const status = index.statuses.get(ticket.statusId ?? "");
  return {
    id: ticket.id,
    shorthand: ticket.shorthand,
    title: ticket.title,
    state: ticketState(
      ticket,
      {
        humanNeeded,
        inputReceived: !humanNeeded && requests.some((request) => request.state === "answered"),
        unmet: flags.includes("waiting"),
      },
      index.workflow,
    ),
    trackId: ticket.tagIds?.find((id) => index.trackOptionIds.has(id)) ?? null,
    requests,
    requestErrors: errors,
    instructions: ticket.content ?? "",
    status: status ? { id: status.id, name: status.name, icon: status.icon, color: status.color } : null,
    done: isDone(ticket, index),
    step,
    ancestors: ancestors(ticket, index),
    ...(gate ? { gate: true as const } : {}),
    deadlineId: deadline?.id ?? null,
    dependsOn: dependsOn.map((ticket) => link(ticket, index)),
    blocks: (index.dependents.get(ticket.id) ?? [])
      .filter((dependent) => !isDone(dependent, index))
      .map((ticket) => link(ticket, index)),
    laterDependencies: late.map((ticket) => link(ticket, index)),
    ...(blockedReason ? { blockedReason } : {}),
    tagIds: ticket.tagIds ?? [],
    flags,
    target: ticketTarget(ticket),
  };
}

export function buildPlan(input: PlanInput) {
  const groups = executionOrder(input.plan);
  const index = indexInput({ ...input, tickets: withIndependentBlockers(input.tickets) }, groups);
  const sections = groups.map(({ deadline, ticketIds }) => {
    const rows = ticketIds.flatMap((id) => {
      const ticket = index.tickets.get(id);
      return ticket ? [toRow(ticket, deadline, index)] : [];
    });
    return { deadline: deadline ? { ...deadline, daysLeft: daysBetween(input.today, deadline.date) } : null, rows };
  });
  const pace = projectPace(
    sections.flatMap(({ rows }) => rows),
    input.tags,
    input.attempts ?? [],
    input.now ?? Date.parse(`${input.today}T00:00:00Z`),
  );
  return {
    pace,
    statuses: input.statuses,
    today: input.today,
    sections: sections.map((section) => summarizeSection(section, input.tags, pace)),
    tags: input.tags,
    trackProperty: input.track,
  };
}
