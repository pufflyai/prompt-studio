import type { HostCommandEvent } from "../hooks/host-context";

export const TAGS_QUERY_KEY = ["tags"] as const;

const TAG_DEFINITION_COMMAND_IDS = new Set([
  "pstdio-planner.ticketTag.create",
  "pstdio-planner.ticketTag.update",
  "pstdio-planner.ticketTag.delete",
  "pstdio-planner.ticketTag.createOption",
  "pstdio-planner.ticketTag.updateOption",
  "pstdio-planner.ticketTag.deleteOption",
]);

export const shouldRefreshTagsForCommand = (event: HostCommandEvent | null | undefined) =>
  Boolean(event && event.outcome.status === "success" && TAG_DEFINITION_COMMAND_IDS.has(event.commandId));
