import type { PlannerStatus, PlannerTag, PlannerTicket } from "./planner-client";

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Conventional board column names, tried in order; a project may rename columns.
export const statusIdByNames = (statuses: PlannerStatus[], names: string[]) => {
  for (const name of names) {
    const match = statuses.find((status) => sameName(status.name, name));
    if (match) return match.id;
  }
  return null;
};

export const AWAITING_INPUT_TAG_ID = "default-awaiting-input";
export const AWAITING_INPUT_OPTION_ID = "default-awaiting-input-true";

export const awaitingInputTag = (tags: PlannerTag[]) => tags.find((tag) => tag.id === AWAITING_INPUT_TAG_ID) ?? null;

export const isAwaitingInput = (ticket: PlannerTicket, tags: PlannerTag[]) => {
  const tag = awaitingInputTag(tags);
  if (!tag) return false;
  return (
    tag.options.some((option) => option.id === AWAITING_INPUT_OPTION_ID) &&
    (ticket.tagIds ?? []).includes(AWAITING_INPUT_OPTION_ID)
  );
};

// Automation only touches real board tickets; drafts are still being authored.
export const automatable = (tickets: PlannerTicket[], tags: PlannerTag[]) =>
  tickets.filter((ticket) => !ticket.draft && !isAwaitingInput(ticket, tags));

export const byUpdatedAtAsc = (a: PlannerTicket, b: PlannerTicket) => a.updatedAt.localeCompare(b.updatedAt);

// Highest priority first (priority options are ordered Low → Urgent), untagged last,
// ties broken by oldest created.
export const byPriorityThenCreatedAt = (tags: PlannerTag[]) => {
  const priority = tags.find((tag) => sameName(tag.name, "Priority"));
  const rankByOptionId = new Map((priority?.options ?? []).map((option) => [option.id, option.sortOrder]));
  const rankOf = (ticket: PlannerTicket) =>
    Math.max(-1, ...(ticket.tagIds ?? []).map((id) => rankByOptionId.get(id) ?? -1));

  return (a: PlannerTicket, b: PlannerTicket) => rankOf(b) - rankOf(a) || a.createdAt.localeCompare(b.createdAt);
};
