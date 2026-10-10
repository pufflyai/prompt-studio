// Turn the resolved execution order into deadline sections with steps, tags, blockers, and risk flags.
import { hasPendingInput } from "../../data/review-request-storage";
import type { TicketReviewRequests } from "../../data/review-request-types";
import type { Deadline, PlanFlag, PlanLink, PlanRow, PlanTag, StoredPlan } from "../contracts";
import { dependencyIds, humanRequestedTagId, type PlannerStatus, type PlannerTicket, ticketTarget } from "../planner";
import { daysBetween } from "./days";
import { ticketState } from "./state";
import { trackProperty } from "./tracks";
import { workflowName } from "./workflow";

// Deadlines inside this many days are shown as due soon.
const dueSoonDays = 7;

export interface PlanInput {
  requests?: Map<string, TicketReviewRequests>;
  gates?: Set<string>;
  track?: PlanTag;
  tickets: PlannerTicket[];
  statuses: PlannerStatus[];
  tags: PlanTag[];
  // A plan completed by resolvePlan, so every ticket has exactly one entry.
  plan: StoredPlan;
  today: string;
}

interface PlanIndex {
  tickets: Map<string, PlannerTicket>;
  statuses: Map<string, string>;
  steps: Map<string, number>;
  dependents: Map<string, PlannerTicket[]>;
  today: string;
  trackOptionIds: Set<string>;
  requests: Map<string, TicketReviewRequests>;
  gates: Set<string>;
}

const statusName = (ticket: PlannerTicket, index: PlanIndex) => index.statuses.get(ticket.statusId ?? "");
const isDone = (ticket: PlannerTicket, index: PlanIndex) => workflowName(statusName(ticket, index)) === "done";

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
    tickets: new Map(input.tickets.map((ticket) => [ticket.id, ticket])),
    statuses: new Map(input.statuses.map((status) => [status.id, status.name])),
    steps: new Map(groups.flatMap(({ ticketIds }) => ticketIds).map((id, position) => [id, position + 1])),
    dependents,
    today: input.today,
    requests: input.requests ?? new Map(),
    gates: input.gates ?? new Set(),
    trackOptionIds: new Set((input.track ?? trackProperty(input.tags))?.options.map(({ id }) => id)),
  };
}

const requestsFor = (ticket: PlannerTicket, index: PlanIndex) =>
  index.requests.get(ticket.id) ?? { requests: [], errors: [] };

// Any open request or an explicit Review Needed flag asks for input. Answers to other requests never hide them.
const needsHuman = (ticket: PlannerTicket, index: PlanIndex) =>
  hasPendingInput(requestsFor(ticket, index)) || ticket.tagIds?.includes(humanRequestedTagId) === true;

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
  } else if (!waiting && (workflowName(statusName(ticket, index)) === "blocked" || ticket.blockedReason?.trim())) {
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
      statusName(ticket, index),
    ),
    trackId: ticket.tagIds?.find((id) => index.trackOptionIds.has(id)) ?? null,
    requests,
    requestErrors: errors,
    instructions: ticket.content ?? "",
    status: (ticket.statusId && index.statuses.get(ticket.statusId)) || "No status",
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

const atRisk = (row: PlanRow) =>
  !row.done &&
  row.flags.some(
    (flag) => flag === "human-needed" || flag === "blocked" || flag === "waiting" || flag === "out-of-order",
  );

function toSection(deadline: Deadline | undefined, rows: PlanRow[], today: string) {
  return {
    deadline: deadline ? { ...deadline, daysLeft: daysBetween(today, deadline.date) } : null,
    rows,
    counts: {
      total: rows.length,
      done: rows.filter((row) => row.done).length,
      humanNeeded: rows.filter((row) => row.flags.includes("human-needed")).length,
      blocked: rows.filter((row) => row.flags.includes("blocked")).length,
      // Risk is measured against a deadline, so unscheduled work has none.
      atRisk: deadline ? rows.filter(atRisk).length : 0,
    },
  };
}

export function buildPlan(input: PlanInput) {
  const groups = executionOrder(input.plan);
  const index = indexInput(input, groups);
  const sections = groups.map(({ deadline, ticketIds }) =>
    toSection(
      deadline,
      ticketIds.flatMap((id) => {
        const ticket = index.tickets.get(id);
        return ticket ? [toRow(ticket, deadline, index)] : [];
      }),
      input.today,
    ),
  );
  return {
    statuses: input.statuses,
    today: input.today,
    sections,
    tags: input.tags,
    trackProperty: input.track ?? trackProperty(input.tags),
  };
}
