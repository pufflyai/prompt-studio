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

export const HUMAN_REQUESTED_TAG_ID = "default-human-requested";
export const HUMAN_REQUESTED_OPTION_ID = "default-human-requested-true";

export const humanRequestedTag = (tags: PlannerTag[]) => tags.find((tag) => tag.id === HUMAN_REQUESTED_TAG_ID) ?? null;

export const hasHumanRequested = (ticket: PlannerTicket, tags: PlannerTag[]) => {
  const tag = humanRequestedTag(tags);
  if (!tag) return false;
  return (
    tag.options.some((option) => option.id === HUMAN_REQUESTED_OPTION_ID) &&
    (ticket.tagIds ?? []).includes(HUMAN_REQUESTED_OPTION_ID)
  );
};

// Automation only touches real board tickets; drafts are still being authored.
export const automatable = (tickets: PlannerTicket[], tags: PlannerTag[]) =>
  tickets.filter((ticket) => !ticket.draft && !hasHumanRequested(ticket, tags));

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
