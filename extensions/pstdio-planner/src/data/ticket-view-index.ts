import type { StorageRecordIndex } from "@pstdio/sdk/extensions";
import { reviewLinkProjections } from "./review-link-projections";
import { TICKET_KEY_PREFIX } from "./ticket-record-address";

// Global predicates and small card fields read the narrow projection, avoiding decompression
// of every matching ticket body. Installation backfills these fields in bounded pages.
const projected = <T extends StorageRecordIndex["fields"][string]["type"]>(path: string, type: T) => ({
  path: [path],
  type,
  derive: { kind: "expression" as const, expression: { variable: "value" } },
});

// Historical date-only metadata keeps viewer-zone midnight semantics. This indexed
// flag lets normal ISO instant metadata use its stored numeric order without a scan.
const calendarOnly = (path: string): StorageRecordIndex["fields"][string] => ({
  path: [path],
  type: "boolean",
  derive: {
    kind: "expression",
    expression: { op: "eq", args: [{ op: "length", args: [{ variable: "value" }] }, { literal: 10 }] },
  },
});

export const ticketViewIndex: StorageRecordIndex = {
  name: "ticket-view",
  keyPrefix: TICKET_KEY_PREFIX,
  identity: { kind: "ticket", idField: "id", shorthandField: "shorthand", aliasesField: "aliases" },
  hierarchy: {
    idField: "id",
    parentField: "parentId",
    labelField: "shorthand",
    breadcrumbField: "breadcrumb",
    separator: " / ",
  },
  fields: {
    id: projected("id", "string"),
    linkScope: { path: [], type: "string", derive: { kind: "expression", expression: { literal: "tickets" } } },
    shorthand: projected("shorthand", "string"),
    aliases: projected("aliases", "array"),
    breadcrumb: { path: ["breadcrumb"], type: "string" },
    title: {
      path: ["content"],
      type: "string",
      derive: { kind: "markdownTitle", fallbackPath: ["title"], empty: "Untitled" },
    },
    statusId: projected("statusId", "string"),
    archived: projected("archived", "boolean"),
    draft: projected("draft", "boolean"),
    position: projected("position", "string"),
    createdAt: projected("createdAt", "string"),
    createdCalendarOnly: calendarOnly("createdAt"),
    createdInstant: { path: ["createdAt"], type: "number", derive: { kind: "timestamp" } },
    updatedAt: projected("updatedAt", "string"),
    updatedCalendarOnly: calendarOnly("updatedAt"),
    updatedInstant: { path: ["updatedAt"], type: "number", derive: { kind: "timestamp" } },
    parentId: projected("parentId", "string"),
    blockedReason: projected("blockedReason", "string"),
    ...reviewLinkProjections,
    dependencyReasonRefs: {
      path: ["blockedReason"],
      type: "array",
      derive: {
        kind: "tokens",
        pattern: "^Complete (.+) before implementing this dependent contract\\.$",
        split: ",\\s*(?:and\\s+)?|\\s+and\\s+",
        itemPattern: "^[A-Z][A-Z0-9]*-\\d+$",
        trim: true,
      },
    },
    dependsOn: { path: ["dependsOn"], type: "array", derive: { kind: "stringList", trim: true, exclude: ["[]"] } },
    tags: { path: ["tags"], type: "object", derive: { kind: "selections", selectionPath: ["tagSelections"] } },
    parentShorthand: {
      type: "string",
      lookup: { index: "ticket-view", on: [{ sourceField: "parentId", relatedField: "id" }], field: "shorthand" },
    },
    parentTitle: {
      type: "string",
      lookup: { index: "ticket-view", on: [{ sourceField: "parentId", relatedField: "id" }], field: "title" },
    },
    deadlineId: {
      type: "string",
      lookup: {
        index: "timeline-placements",
        on: [{ sourceField: "id", relatedField: "ticketId" }],
        field: "deadlineId",
      },
    },
    planPosition: {
      type: "string",
      lookup: {
        index: "timeline-placements",
        on: [{ sourceField: "id", relatedField: "ticketId" }],
        field: "position",
      },
    },
    gate: {
      type: "string",
      lookup: { index: "timeline-gates", on: [{ sourceField: "id", relatedField: "ticketId" }], field: "ticketId" },
    },
  },
  equality: ["id", "linkScope", "archived", "statusId", "createdCalendarOnly", "updatedCalendarOnly"],
  orderBy: [{ field: "position", direction: "asc" }],
};
