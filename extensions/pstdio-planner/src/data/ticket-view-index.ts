import type { StorageRecordIndex } from "@pstdio/sdk/extensions";
import { reviewLinkProjections } from "./review-link-projections";

export const ticketViewIndex: StorageRecordIndex = {
  name: "ticket-view",
  collection: "tickets",
  identity: { kind: "ticket", idField: "id", shorthandField: "shorthand", aliasesField: "aliases" },
  hierarchy: {
    idField: "id",
    parentField: "parentId",
    labelField: "shorthand",
    breadcrumbField: "breadcrumb",
    separator: " / ",
  },
  fields: {
    id: { path: ["id"], type: "string" },
    shorthand: { path: ["shorthand"], type: "string" },
    aliases: { path: ["aliases"], type: "array" },
    breadcrumb: { path: ["breadcrumb"], type: "string" },
    title: {
      path: ["content"],
      type: "string",
      derive: { kind: "markdownTitle", fallbackPath: ["title"], empty: "Untitled" },
    },
    statusId: { path: ["statusId"], type: "string" },
    archived: { path: ["archived"], type: "boolean" },
    draft: { path: ["draft"], type: "boolean" },
    position: { path: ["position"], type: "string" },
    createdAt: { path: ["createdAt"], type: "string" },
    updatedAt: { path: ["updatedAt"], type: "string" },
    updatedInstant: { path: ["updatedAt"], type: "number", derive: { kind: "timestamp" } },
    parentId: { path: ["parentId"], type: "string" },
    blockedReason: { path: ["blockedReason"], type: "string" },
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
  equality: ["id", "archived"],
  orderBy: [{ field: "position", direction: "asc" }],
};
