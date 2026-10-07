// Name the Planner commands, events, and pages this extension reads, in one place.
import {
  type CommandContext,
  type CommandRef,
  commandRef,
  eventRef,
  type NavigationTargetPage,
  type Struct,
} from "@pstdio/sdk/extensions";

export const plannerExtensionId = "pstdio.pstdio-planner";

// Planner seeds these status ids. The plan treats them as finished and blocked work.
export const doneStatusId = "done";
export const blockedStatusId = "blocked";
// Planner's existing human-attention flag also marks decisions, access and handoffs.
export const humanRequestedTagId = "default-human-requested-true";

export interface PlannerTicket {
  id: string;
  shorthand: string;
  title: string;
  statusId: string | null;
  content?: string;
  tagIds?: string[];
  parentId?: string | null;
  dependsOn?: string | string[] | null;
  blockedReason?: string | null;
}

export interface PlannerTag {
  type: string;
  id: string;
  name: string;
  options: Array<{ id: string; name: string }>;
}

export interface PlannerStatus {
  id: string;
  name: string;
}

const plannerCommand = commandRef.forExtension({ publisher: "pstdio", name: "pstdio-planner" });

export const planner = {
  getTicket: plannerCommand<{ id: string }, PlannerTicket | null>("get-ticket"),
  createTag: plannerCommand<{ name: string; type: string }, PlannerTag>("ticket-tag.create"),
  createOption: plannerCommand<{ tagId: string; name: string }, { id: string; name: string }>(
    "ticket-tag.create-option",
  ),
  updateOption: plannerCommand<{ tagId: string; optionId: string; name: string }, { id: string; name: string }>(
    "ticket-tag.update-option",
  ),
  setAttribute: plannerCommand<{ rowId: string; attributeId: string; value: string }, PlannerTicket | null>(
    "set-ticket-attribute",
  ),
  createTicket: plannerCommand<
    { title: string; content: string; tagIds: string[]; dependsOn: string[] },
    PlannerTicket
  >("create-ticket"),
  readTickets: plannerCommand<Record<string, never>, PlannerTicket[]>("read-tickets"),
  readStatuses: plannerCommand<Record<string, never>, { statuses: PlannerStatus[] }>("ticket-status.read"),
  readTags: plannerCommand<Record<string, never>, { tags: PlannerTag[] }>("ticket-tag.read"),
};

// Run a Planner command and turn a refusal into an error that names the command.
export async function callPlanner<TParams extends Struct, TResult>(
  ctx: Pick<CommandContext, "commands">,
  command: CommandRef<TParams, TResult>,
  commandParams: TParams,
) {
  const outcome = await ctx.commands.execute(command, { params: commandParams });
  if (!outcome.ok) {
    throw new Error(`Planner command ${command.id} failed: ${outcome.reason}`);
  }

  return outcome.value;
}

export const plannerTicketsChanged = eventRef<{ ticketId?: string }>({
  extensionId: plannerExtensionId,
  id: "tickets.changed",
});

const plannerPage = (id: string) => ({ kind: "page" as const, id, extensionId: plannerExtensionId });

// Planner owns its ticket pages; the plan only links to them.
export const ticketTarget = (ticket: Pick<PlannerTicket, "id" | "shorthand" | "title">): NavigationTargetPage => ({
  kind: "page",
  page: plannerPage("ticket"),
  resource: {
    type: "ticket",
    id: ticket.id,
    shorthand: ticket.shorthand,
    label: `${ticket.shorthand} ${ticket.title}`,
    extensionId: plannerExtensionId,
  },
  parent: { kind: "page", page: plannerPage("tickets") },
});

export const dependencyIds = (value: PlannerTicket["dependsOn"]) => {
  const values = Array.isArray(value) ? value : [value ?? ""];
  return values.map((id) => id.trim()).filter((id) => id.length > 0 && id !== "[]");
};
