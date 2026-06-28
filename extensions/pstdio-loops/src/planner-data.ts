import type { CommandHelpersApi, CommandOutcome } from "@pstdio/sdk/extensions";
import {
  type PlannerStatus,
  type PlannerTag,
  type PlannerTicket,
  readStatusesRef,
  readTagsRef,
  readTicketsRef,
  type WorkspaceActivityResult,
  workspaceActivityRef,
} from "./planner-commands";

const unwrap = <T>(outcome: CommandOutcome<T>): T => {
  if (outcome.ok) return outcome.value;
  throw new Error(`Planner command failed: ${outcome.reason}`);
};

// Thin read-side helpers that route every fetch through the planner's public
// command surface. The automation extension never touches planner storage
// directly, so the data boundary lives at these typed command refs.

export const fetchTickets = async (commands: CommandHelpersApi) =>
  unwrap<PlannerTicket[]>(await commands.execute(readTicketsRef, { params: {} }));

export const fetchStatuses = async (commands: CommandHelpersApi) => {
  const result = unwrap<{ statuses: PlannerStatus[] }>(await commands.execute(readStatusesRef, { params: {} }));
  return result.statuses;
};

export const fetchTags = async (commands: CommandHelpersApi) => {
  const result = unwrap<{ tags: PlannerTag[] }>(await commands.execute(readTagsRef, { params: {} }));
  return result.tags;
};

export const fetchWorkspaceActivity = async (commands: CommandHelpersApi, workspaceId: string) =>
  unwrap<WorkspaceActivityResult>(await commands.execute(workspaceActivityRef, { params: { workspaceId } }));

export const HUMAN_REQUESTED_TAG_NAME = "human_requested";

export const findHumanRequestedOptionId = (tags: PlannerTag[]) => {
  const tag = tags.find((candidate) => candidate.name.toLowerCase() === HUMAN_REQUESTED_TAG_NAME);
  // The tag is single-select with one option after PS-94 phase 1; if the user
  // adds more options the first one wins (oldest, lowest sortOrder).
  return tag?.options[0]?.id;
};

export const hasTagOption = (ticket: PlannerTicket, optionId: string | undefined) => {
  if (!optionId) return false;
  return (ticket.tagIds ?? []).includes(optionId);
};
