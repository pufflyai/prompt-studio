import type { CommandContext } from "@pstdio/sdk/extensions";
import type { readTicketViewPage } from "../../data/query-ticket-page";
import { normalizeTicketDependencies } from "../../data/ticket-dependencies";
import type { readTicketParentLookup } from "../../data/ticket-resource-hierarchy";
import { ticketTagIds } from "../../data/ticket-tags";
import type { PlanRow } from "../contracts";
import { daysBetween } from "../model/days";
import { ticketState } from "../model/state";
import { planStepCounts } from "./plan-step-counts";
import { readTrack } from "./track-commands";

export const planPageRows = async (
  ctx: CommandContext,
  view: Awaited<ReturnType<typeof readTicketViewPage>>,
  executionOffset?: number,
) => {
  const track = await readTrack(ctx, view.tags);
  const trackIds = new Set(track?.options.map(({ id }) => id));
  const parents = view.parents;
  const statuses = new Map(view.statuses.map((status) => [status.id, status]));
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  const steps = await planStepCounts(ctx, view, executionOffset);
  const rows: PlanRow[] = [];
  for (const [i, ticket] of view.tickets.entries())
    rows.push(await pageRow(ctx, { view, ticket, trackIds, parents, statuses, today, step: steps[i] }));
  return { rows, track, today };
};

const rowFlags = ({
  done,
  deadline,
  today,
  pending,
  waiting,
  blockedReason,
  ticket,
  view,
}: {
  done: boolean;
  deadline: Awaited<ReturnType<typeof readTicketViewPage>>["metadata"]["deadlines"][number] | undefined;
  today: string;
  pending: boolean;
  waiting: boolean;
  blockedReason: unknown;
  ticket: Awaited<ReturnType<typeof readTicketViewPage>>["tickets"][number];
  view: Awaited<ReturnType<typeof readTicketViewPage>>;
}) => {
  const flags: PlanRow["flags"] = [];
  if (!done) {
    if (deadline && daysBetween(today, deadline.date) <= 7) flags.push(deadline.date < today ? "overdue" : "due-soon");
    if (pending) flags.push("review-needed");
    else if (
      !waiting &&
      (view.workflow.blockedStatusIds.includes(ticket.statusId ?? "") || String(blockedReason ?? "").trim())
    )
      flags.push("blocked");
    if (waiting) flags.push("waiting");
  }

  return flags;
};

const pageRow = async (
  ctx: CommandContext,
  {
    view,
    ticket,
    trackIds,
    parents,
    statuses,
    today,
    step,
  }: {
    view: Awaited<ReturnType<typeof readTicketViewPage>>;
    ticket: Awaited<ReturnType<typeof readTicketViewPage>>["tickets"][number];
    trackIds: Set<string>;
    parents: Awaited<ReturnType<typeof readTicketParentLookup>>;
    statuses: Map<string, Awaited<ReturnType<typeof readTicketViewPage>>["statuses"][number]>;
    today: string;
    step: number;
  },
) => {
  const fields = view.projections.get(ticket.id)!;
  // Graph edges connect resident nodes. The selected ticket opens independent relationship pages.
  const resident = (item: typeof ticket) => ({
    ...item,
    planPosition: view.projections.get(item.id)?.planPosition,
    deadlineId: view.projections.get(item.id)?.deadlineId,
  });
  const dependencies = view.tickets
    .filter(({ id }) => normalizeTicketDependencies(ticket.dependsOn).includes(id))
    .map(resident);
  const dependents = view.tickets
    .filter((item) => normalizeTicketDependencies(item.dependsOn).includes(ticket.id))
    .map(resident);
  const reviews = view.reviews.get(ticket.id)!;
  const done = view.workflow.completedStatusIds.includes(ticket.statusId ?? "");
  const link = (item: { id: string; shorthand: string; statusId?: string | null }) => ({
    id: item.id,
    shorthand: item.shorthand,
    done: view.workflow.completedStatusIds.includes(item.statusId ?? ""),
  });
  const waiting = fields.hasUnmetDependency === true;
  const pending = reviews.pending > 0;
  const blockedReason = fields.independentBlockedReason === true ? fields.blockedReason : undefined;
  const deadlineId = typeof fields.deadlineId === "string" ? fields.deadlineId : null;
  const deadline = view.metadata.deadlines.find(({ id }) => id === deadlineId);
  const flags = rowFlags({ done, deadline, today, pending, waiting, blockedReason, ticket, view });
  const ranks = new Map(view.metadata.deadlines.map(({ id }, i) => [id, i]));
  const rank = (id: unknown) => ranks.get(String(id)) ?? view.metadata.deadlines.length;
  const late = dependencies.filter(
    (dependency) =>
      !link(dependency).done &&
      (rank(dependency.deadlineId) > rank(deadlineId) ||
        (rank(dependency.deadlineId) === rank(deadlineId) &&
          String(dependency.planPosition) > String(fields.planPosition))),
  );
  if (!done && fields.hasLaterDependency === true) flags.push("out-of-order");
  const ancestors = [];
  const seen = new Set([ticket.id]);
  let parent = ticket.parentId ? parents.get(ticket.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    ancestors.unshift(link(parent));
    parent = parent.parentId ? parents.get(parent.parentId) : undefined;
  }
  const gate = typeof fields.gate === "string";
  const instructions = gate
    ? ((await ctx.storage.collection<{ content?: string }>("tickets").get(ticket.id))?.content ?? "")
    : "";
  const status = statuses.get(ticket.statusId ?? "");
  const target = view.result.rows.find(({ id }) => id === ticket.id)!.target!;
  return {
    id: ticket.id,
    shorthand: ticket.shorthand,
    title: ticket.title,
    status: status ? { id: status.id, name: status.name, icon: status.icon, color: status.color } : null,
    state: ticketState(
      { ...ticket, content: "", blockedReason: typeof blockedReason === "string" ? blockedReason : undefined },
      { reviewNeeded: pending, inputReceived: !pending && reviews.answered > 0, unmet: waiting },
      view.workflow,
    ),
    trackId: ticketTagIds(ticket).find((id) => trackIds.has(id)) ?? null,
    requests: [],
    requestErrors: [],
    reviewCounts: reviews,
    relationsPaged: true,
    instructions,
    done,
    step,
    ancestors,
    ...(gate ? { gate: true } : {}),
    deadlineId,
    dependsOn: dependencies.map(link),
    blocks: dependents.filter((ticket) => !link(ticket).done).map(link),
    laterDependencies: late.map(link),
    ...(blockedReason && !done ? { blockedReason: String(blockedReason) } : {}),
    tagIds: ticketTagIds(ticket),
    flags,
    target,
  } satisfies PlanRow;
};
