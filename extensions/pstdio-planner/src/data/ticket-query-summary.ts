import type { JsonValue } from "@pstdio/sdk/extensions";
import type { TicketSummary } from "./ticket-summary";
import type { StoredTicketTags } from "./types";

export const ticketSummaryFields = [
  "id",
  "shorthand",
  "title",
  "parentId",
  "archived",
  "statusId",
  "tags",
  "createdAt",
  "updatedAt",
  "dependsOn",
];
export const ticketQuerySummary = (fields: Record<string, JsonValue>): TicketSummary | undefined => {
  if (typeof fields.id !== "string" || typeof fields.shorthand !== "string") return undefined;
  return {
    id: fields.id,
    shorthand: fields.shorthand,
    title: typeof fields.title === "string" ? fields.title : "",
    parentId: typeof fields.parentId === "string" ? fields.parentId : null,
    archived: fields.archived === true,
    statusId: typeof fields.statusId === "string" ? fields.statusId : null,
    tags:
      fields.tags && typeof fields.tags === "object" && !Array.isArray(fields.tags)
        ? (fields.tags as StoredTicketTags)
        : {},
    createdAt: typeof fields.createdAt === "string" ? fields.createdAt : "",
    updatedAt: typeof fields.updatedAt === "string" ? fields.updatedAt : "",
    dependsOn: Array.isArray(fields.dependsOn) ? (fields.dependsOn as string[]) : [],
  };
};
