// Turn the resolved execution order into deadline sections with steps, tags, blockers, and risk flags.
import type { ArtifactNode } from "../artifacts";
import type { Deadline, Plan, PlanFlag, PlanLink, PlanRow, PlanSection, PlanTag, StoredPlan } from "../contracts";
import {
  blockedStatusId,
  dependencyIds,
  doneStatusId,
  humanRequestedTagId,
  type PlannerStatus,
  type PlannerTicket,
  ticketTarget,
} from "../planner";
import type { TicketAction } from "./action-types";
import { daysBetween } from "./days";
import { ticketState } from "./state";
import { trackProperty } from "./tracks";

// Deadlines inside this many days are shown as due soon.
const dueSoonDays = 7;

export interface PlanInput {
  actions?: Map<string, { actions: TicketAction[]; errors: string[] }>;
  gates?: Set<string>;
  artifacts?: Map<string, ArtifactNode>;
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
  actions: Map<string, { actions: TicketAction[]; errors: string[] }>;
  gates: Set<string>;
  artifacts: Map<string, ArtifactNode>;
}

const isDone = (ticket: PlannerTicket) => ticket.statusId === doneStatusId;

const link = (ticket: PlannerTicket): PlanLink => ({
  id: ticket.id,
  shorthand: ticket.shorthand,
  done: isDone(ticket),
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

function indexInput(input: PlanInput, groups: ReturnType<typeof executionOrder>): PlanIndex {
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
    actions: input.actions ?? new Map(),
    gates: input.gates ?? new Set(),
    artifacts: input.artifacts ?? new Map(),
    trackOptionIds: new Set((input.track ?? trackProperty(input.tags))?.options.map(({ id }) => id)),
  };
}

const documentsFor = (ticket: PlannerTicket, index: PlanIndex) =>
  index.actions.get(ticket.id) ?? { actions: [], errors: [] };

const answered = (ticket: PlannerTicket, index: PlanIndex) =>
  documentsFor(ticket, index).actions.some((action) => action.resolution);

// The Human Needed tag asks for input until a request is answered; open requests and errors always ask.
function needsHuman(ticket: PlannerTicket, index: PlanIndex) {
  const documents = documentsFor(ticket, index);
  return (
    documents.actions.some((action) => !action.resolution && !action.cancellation) ||
    documents.errors.length > 0 ||
    (ticket.tagIds?.includes(humanRequestedTagId) === true && !answered(ticket, index))
  );
}

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

  return chain.map(link);
}

function flagsFor(ticket: PlannerTicket, deadline: Deadline | undefined, late: PlanLink[], index: PlanIndex) {
  if (isDone(ticket)) {
    return [];
  }

  const flags: PlanFlag[] = [];
  if (deadline && deadline.date < index.today) {
    flags.push("overdue");
  } else if (deadline && daysBetween(index.today, deadline.date) <= dueSoonDays) {
    flags.push("due-soon");
  }

  if (needsHuman(ticket, index)) {
    flags.push("human-needed");
  } else if (ticket.statusId === blockedStatusId || ticket.blockedReason?.trim()) {
    flags.push("blocked");
  }

  if (dependencies(ticket, index).some((dependency) => !isDone(dependency))) {
    flags.push("waiting");
  }

  if (late.length > 0) {
    flags.push("out-of-order");
  }

  return flags;
}

function toRow(ticket: PlannerTicket, deadline: Deadline | undefined, index: PlanIndex): PlanRow {
  const step = index.steps.get(ticket.id) ?? 0;
  const dependsOn = dependencies(ticket, index);
  const late = dependsOn.filter((dependency) => !isDone(dependency) && (index.steps.get(dependency.id) ?? 0) > step);
  const blockedReason = isDone(ticket) ? undefined : ticket.blockedReason?.trim() || undefined;
  const documents = documentsFor(ticket, index);
  const flags = flagsFor(ticket, deadline, late.map(link), index);
  const humanNeeded = flags.includes("human-needed");
  const gate = index.gates.has(ticket.id);
  const artifact = index.artifacts.get(ticket.id);
  return {
    id: ticket.id,
    shorthand: ticket.shorthand,
    title: ticket.title,
    state: ticketState(ticket, {
      humanNeeded,
      inputReceived: !humanNeeded && answered(ticket, index),
      unmet: dependsOn.some((dependency) => !isDone(dependency)),
    }),
    trackId: ticket.tagIds?.find((id) => index.trackOptionIds.has(id)) ?? null,
    actions: documents.actions,
    actionErrors: documents.errors,
    instructions: ticket.content ?? "",
    status: (ticket.statusId && index.statuses.get(ticket.statusId)) || "No status",
    done: isDone(ticket),
    step,
    ancestors: ancestors(ticket, index),
    ...(gate ? { gate: true as const } : {}),
    ...(artifact ? { artifact } : {}),
    deadlineId: deadline?.id ?? null,
    dependsOn: dependsOn.map(link),
    blocks: (index.dependents.get(ticket.id) ?? []).filter((dependent) => !isDone(dependent)).map(link),
    laterDependencies: late.map(link),
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

function toSection(deadline: Deadline | undefined, rows: PlanRow[], today: string): PlanSection {
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

export function buildPlan(input: PlanInput): Plan {
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
  return { today: input.today, sections, tags: input.tags, trackProperty: input.track ?? trackProperty(input.tags) };
}
